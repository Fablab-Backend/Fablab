import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/users.model';
import { UserRole } from '../../common/enums/user-role.enum';
import { ResourcesService } from '../resources/resources.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.model';
import { NotifyInput } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  EquipmentCondition,
  Loan,
  LoanDocument,
  LoanStatus,
} from './loans.model';
import { CreateLoanDto, LoanQueryDto, ReturnLoanDto } from './loans.validation';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_LOAN_DAYS = 14;
const PRIVILEGED_ROLES: UserRole[] = [
  UserRole.RESPONSABLE,
  UserRole.ADMINISTRATEUR,
];
const UNUSABLE_EQUIPMENT_STATES = ['broken', 'maintenance'];

export interface LoanListItem {
  status: LoanStatus;
  dueAt?: Date | string;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @InjectModel(Loan.name)
    private readonly loanModel: Model<LoanDocument>,
    private readonly resourcesService: ResourcesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(actor: UserDocument, query: LoanQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (!PRIVILEGED_ROLES.includes(actor.role)) {
      filter.borrowerId = actor._id;
    }
    if (query.equipmentId) {
      filter.equipmentId = new Types.ObjectId(query.equipmentId);
    }

    const now = new Date();
    if (query.status === LoanStatus.OVERDUE) {
      // Statut effectif : stocké OVERDUE, ou ACTIVE avec dueAt dépassé.
      filter.$or = [
        { status: LoanStatus.OVERDUE },
        { status: LoanStatus.ACTIVE, dueAt: { $lt: now } },
      ];
    } else if (query.status === LoanStatus.ACTIVE) {
      filter.status = LoanStatus.ACTIVE;
      filter.dueAt = { $gte: now };
    } else if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.loanModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.loanModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.withEffectiveStatus(item, now)),
      total,
      page,
      limit,
    };
  }

  async create(actor: UserDocument, dto: CreateLoanDto): Promise<LoanDocument> {
    const equipment = await this.assertLoanableEquipment(dto.equipmentId);

    const dueAt = this.assertValidDueAt(dto.dueAt);

    let borrowerId = actor._id;
    if (dto.borrowerId && dto.borrowerId !== actor.id) {
      if (!PRIVILEGED_ROLES.includes(actor.role)) {
        throw new ForbiddenException(
          'Seuls un responsable ou un administrateur peuvent prêter à un autre utilisateur',
        );
      }
      borrowerId = new Types.ObjectId(dto.borrowerId);
    }

    let loan: LoanDocument;
    try {
      loan = await this.loanModel.create({
        equipmentId: new Types.ObjectId(dto.equipmentId),
        borrowerId,
        status: LoanStatus.ACTIVE,
        borrowedAt: new Date(),
        dueAt,
        conditionAtLoan: dto.conditionAtLoan,
        notes: dto.notes,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Cet équipement est déjà prêté');
      }
      throw error;
    }

    await this.auditService.log({
      userId: actor._id.toString(),
      action: 'loan.created',
      resourceType: 'Loan',
      resourceId: loan._id.toString(),
      details: {
        equipmentId: dto.equipmentId,
        borrowerId: borrowerId.toString(),
        dueAt: dueAt.toISOString(),
      },
    });

    await this.safeNotify({
      userId: borrowerId.toHexString(),
      type: NotificationType.LOAN_CREATED,
      title: 'Prêt enregistré',
      message: `Le prêt de « ${equipment.name ?? 'équipement'} » est enregistré jusqu'au ${dueAt.toLocaleDateString('fr-FR')}.`,
      data: { loanId: loan._id.toString(), equipmentId: dto.equipmentId },
    });

    return loan;
  }

  async returnLoan(
    actor: UserDocument,
    id: string,
    dto: ReturnLoanDto,
  ): Promise<LoanDocument> {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException(`Prêt avec l'ID ${id} introuvable`);
    }

    if (!PRIVILEGED_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Seuls un responsable ou un administrateur peuvent enregistrer un retour',
      );
    }

    if (loan.status === LoanStatus.RETURNED) {
      throw new ConflictException('Ce prêt a déjà été retourné');
    }

    loan.status = LoanStatus.RETURNED;
    loan.returnedAt = new Date();
    loan.conditionAtReturn = dto.conditionAtReturn;
    loan.handledBy = actor._id;
    if (dto.notes !== undefined) {
      loan.notes = dto.notes;
    }
    await loan.save();

    await this.auditService.log({
      userId: actor._id.toString(),
      action: 'loan.returned',
      resourceType: 'Loan',
      resourceId: loan._id.toString(),
      details: {
        equipmentId: loan.equipmentId.toString(),
        borrowerId: loan.borrowerId.toString(),
        conditionAtReturn: dto.conditionAtReturn,
      },
    });

    const borrowerNotified = this.safeNotify({
      userId: loan.borrowerId.toHexString(),
      type: NotificationType.LOAN_RETURNED,
      title: 'Prêt retourné',
      message: 'Votre prêt a été clôturé.',
      data: { loanId: loan._id.toString(), equipmentId: loan.equipmentId.toString() },
    });

    if (
      dto.conditionAtReturn === EquipmentCondition.DAMAGED ||
      dto.conditionAtReturn === EquipmentCondition.LOST
    ) {
      await this.notifyManagersOfDamagedReturn(loan, dto.conditionAtReturn);
    }

    await borrowerNotified;
    return loan;
  }

  private async assertLoanableEquipment(equipmentId: string) {
    // findOne lève NotFoundException (404) si la ressource n'existe pas.
    const resource = (await this.resourcesService.findOne(
      equipmentId,
    )) as unknown as {
      id?: string;
      type?: string;
      name?: string;
      state?: string;
      isActive?: boolean;
    };

    if (resource.type !== 'Equipment') {
      throw new BadRequestException(
        'La ressource spécifiée n\'est pas un équipement',
      );
    }
    if (
      resource.isActive === false ||
      UNUSABLE_EQUIPMENT_STATES.includes(resource.state ?? '')
    ) {
      throw new BadRequestException('Cet équipement n\'est pas disponible');
    }
    return resource;
  }

  private assertValidDueAt(dueAtRaw: string): Date {
    const dueAt = new Date(dueAtRaw);
    const now = new Date();
    if (Number.isNaN(dueAt.getTime()) || dueAt <= now) {
      throw new BadRequestException('dueAt doit être une date dans le futur');
    }
    const maxDays = this.maxLoanDays();
    if (dueAt.getTime() - now.getTime() > maxDays * DAY_MS) {
      throw new BadRequestException(
        `dueAt ne peut pas dépasser ${maxDays} jours dans le futur`,
      );
    }
    return dueAt;
  }

  private maxLoanDays(): number {
    const parsed = Number(process.env.LOAN_MAX_DAYS);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_MAX_LOAN_DAYS;
  }

  private withEffectiveStatus<T extends LoanListItem>(loan: T, now: Date): T {
    const dueAt = loan.dueAt ? new Date(loan.dueAt) : null;
    const overdue =
      loan.status === LoanStatus.ACTIVE && dueAt !== null && dueAt < now;
    return { ...loan, status: overdue ? LoanStatus.OVERDUE : loan.status };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === 11000
    );
  }

  private async safeNotify(input: NotifyInput): Promise<void> {
    try {
      await this.notificationsService.notify(input);
    } catch (error) {
      this.logger.error(
        `Échec de l'envoi de la notification ${input.type}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async notifyManagersOfDamagedReturn(
    loan: LoanDocument,
    condition: EquipmentCondition,
  ): Promise<void> {
    try {
      for (const role of PRIVILEGED_ROLES) {
        const { items } = await this.usersService.findAll({
          role,
          isActive: true,
          limit: 100,
        });
        for (const manager of items) {
          await this.safeNotify({
            userId: manager.id,
            type: NotificationType.LOAN_RETURNED,
            title: 'Retour de matériel à vérifier',
            message: `Le prêt ${loan._id.toString()} a été retourné avec le matériel en état ${condition}.`,
            data: {
              loanId: loan._id.toString(),
              equipmentId: loan.equipmentId.toString(),
              conditionAtReturn: condition,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'Échec de la notification des responsables pour un retour endommagé',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
