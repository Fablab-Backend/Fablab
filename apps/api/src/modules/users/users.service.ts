import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './users.model';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserQueryDto,
} from './users.validation';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .lean();
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? UserRole.UTILISATEUR,
      phone: dto.phone,
      organization: dto.organization,
    });

    await this.auditService.log({
      userId: actorId,
      action: 'user.created',
      resourceType: 'user',
      resourceId: user._id.toString(),
      details: { email: user.email, role: user.role },
    });

    return user;
  }

  async findAll(query: UserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      const regex = new RegExp(
        query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toPublic(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  /** Recherche avec le hash du mot de passe (authentification). */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (user as unknown as Record<string, unknown>)[key] = value;
      }
    }
    await user.save();
    return user;
  }

  async updateByAdmin(
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ): Promise<UserDocument> {
    const user = await this.findById(id);
    const changes: Record<string, unknown> = {};

    for (const key of [
      'firstName',
      'lastName',
      'role',
      'isActive',
      'phone',
      'organization',
    ] as const) {
      if (dto[key] !== undefined && dto[key] !== user[key]) {
        changes[key] = { from: user[key], to: dto[key] };
        (user as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await user.save();

    if (Object.keys(changes).length > 0) {
      await this.auditService.log({
        userId: actorId,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: user._id.toString(),
        details: { email: user.email, changes },
      });
    }

    return user;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+passwordHash')
      .exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await user.save();

    await this.auditService.log({
      userId,
      action: 'user.password_changed',
      resourceType: 'user',
      resourceId: userId,
    });
  }

  /** Vérifie les identifiants et retourne l'utilisateur (hash inclus). */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.findByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return null;
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }
    return user;
  }

  /** Représentation publique d'un utilisateur (sans le hash). */
  toPublic(user: UserDocument | Record<string, unknown>) {
    const doc = user as UserDocument;
    return {
      id: doc._id?.toString?.() ?? (doc as { id?: string }).id,
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
      role: doc.role,
      isActive: doc.isActive,
      phone: doc.phone,
      organization: doc.organization,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
