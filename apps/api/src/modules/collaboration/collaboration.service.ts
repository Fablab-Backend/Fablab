import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from 'eventemitter2';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/users.model';
import { UserRole } from '../../common/enums/user-role.enum';
import { ResourcesService } from '../resources/resources.service';
import { AuditService } from '../audit/audit.service';
import {
  Announcement,
  AnnouncementDocument,
  ResourceMessage,
  ResourceMessageDocument,
} from './collaboration.model';
import {
  CreateAnnouncementDto,
  CreateMessageDto,
  ListQueryDto,
  UpdateAnnouncementDto,
} from './collaboration.validation';

export const ANNOUNCEMENT_CREATED_EVENT = 'announcement.created';
export const MESSAGE_CREATED_EVENT = 'message.created';

const PRIVILEGED_ROLES: UserRole[] = [
  UserRole.RESPONSABLE,
  UserRole.ADMINISTRATEUR,
];

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    @InjectModel(Announcement.name)
    private readonly announcementModel: Model<AnnouncementDocument>,
    @InjectModel(ResourceMessage.name)
    private readonly messageModel: Model<ResourceMessageDocument>,
    private readonly resourcesService: ResourcesService,
    private readonly auditService: AuditService,
    // Optionnel : fourni par EventEmitterModule quand le module realtime le câble.
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  // ---------- Annonces ----------

  async listAnnouncements(resourceId: string) {
    await this.assertActiveResource(resourceId);
    const items = await this.announcementModel
      .find({ resourceId: new Types.ObjectId(resourceId), isActive: true })
      .sort({ pinned: -1, createdAt: -1 })
      .lean();
    return { items };
  }

  async createAnnouncement(
    actor: UserDocument,
    resourceId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementDocument> {
    if (!PRIVILEGED_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Seuls un responsable ou un administrateur peuvent publier une annonce',
      );
    }
    await this.assertActiveResource(resourceId);

    const announcement = await this.announcementModel.create({
      resourceId: new Types.ObjectId(resourceId),
      authorId: actor._id,
      title: dto.title,
      content: dto.content,
      pinned: dto.pinned ?? false,
    });

    await this.auditService.log({
      userId: actor._id.toString(),
      action: 'announcement.created',
      resourceType: 'Announcement',
      resourceId: announcement._id.toString(),
      details: { resourceRef: resourceId },
    });

    this.eventEmitter?.emit(ANNOUNCEMENT_CREATED_EVENT, announcement);
    return announcement;
  }

  async updateAnnouncement(
    actor: UserDocument,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementDocument> {
    const announcement = await this.findAnnouncementOrFail(id);
    this.assertCanModerate(actor, announcement.authorId);

    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.content !== undefined) announcement.content = dto.content;
    if (dto.pinned !== undefined) announcement.pinned = dto.pinned;
    await announcement.save();

    await this.auditService.log({
      userId: actor._id.toString(),
      action: 'announcement.updated',
      resourceType: 'Announcement',
      resourceId: announcement._id.toString(),
      details: {
        resourceRef: announcement.resourceId.toString(),
        pinned: announcement.pinned,
      },
    });

    return announcement;
  }

  async deleteAnnouncement(
    actor: UserDocument,
    id: string,
  ): Promise<AnnouncementDocument> {
    const announcement = await this.findAnnouncementOrFail(id);
    this.assertCanModerate(actor, announcement.authorId);

    announcement.isActive = false;
    await announcement.save();

    await this.auditService.log({
      userId: actor._id.toString(),
      action: 'announcement.deleted',
      resourceType: 'Announcement',
      resourceId: announcement._id.toString(),
      details: { resourceRef: announcement.resourceId.toString() },
    });

    return announcement;
  }

  // ---------- Messages ----------

  async listMessages(resourceId: string, query: ListQueryDto) {
    await this.assertActiveResource(resourceId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = {
      resourceId: new Types.ObjectId(resourceId),
      isDeleted: false,
    };

    const [items, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.messageModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async createMessage(
    actor: UserDocument,
    resourceId: string,
    dto: CreateMessageDto,
  ): Promise<ResourceMessageDocument> {
    await this.assertActiveResource(resourceId);

    let parentId: Types.ObjectId | undefined;
    if (dto.parentId) {
      parentId = await this.assertValidParent(resourceId, dto.parentId);
    }

    const message = await this.messageModel.create({
      resourceId: new Types.ObjectId(resourceId),
      authorId: actor._id,
      content: dto.content,
      parentId,
    });

    this.eventEmitter?.emit(MESSAGE_CREATED_EVENT, message);
    return message;
  }

  async deleteMessage(
    actor: UserDocument,
    id: string,
  ): Promise<ResourceMessageDocument> {
    const message = await this.findMessageOrFail(id);
    this.assertCanModerate(actor, message.authorId);

    message.isDeleted = true;
    await message.save();

    const isModerator = !this.isAuthor(actor, message.authorId);
    if (isModerator) {
      await this.auditService.log({
        userId: actor._id.toString(),
        action: 'message.deleted',
        resourceType: 'ResourceMessage',
        resourceId: message._id.toString(),
        details: {
          resourceRef: message.resourceId.toString(),
          authorId: message.authorId.toString(),
        },
      });
    }

    return message;
  }

  // ---------- Helpers ----------

  private async assertActiveResource(resourceId: string) {
    // findOne lève NotFoundException (404) si la ressource n'existe pas.
    const resource = (await this.resourcesService.findOne(
      resourceId,
    )) as unknown as { isActive?: boolean };

    if (resource.isActive === false) {
      throw new BadRequestException('Cette ressource est désactivée');
    }
  }

  private async findAnnouncementOrFail(id: string) {
    const announcement = await this.announcementModel.findById(id);
    if (!announcement) {
      throw new NotFoundException(
        `Annonce avec l'ID ${id} introuvable`,
      );
    }
    return announcement;
  }

  private async findMessageOrFail(id: string) {
    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException(
        `Message avec l'ID ${id} introuvable`,
      );
    }
    return message;
  }

  private async assertValidParent(
    resourceId: string,
    parentId: string,
  ): Promise<Types.ObjectId> {
    const parent = await this.messageModel.findById(parentId);
    if (!parent || parent.isDeleted) {
      throw new BadRequestException('Le message parent est introuvable');
    }
    if (parent.resourceId.toString() !== new Types.ObjectId(resourceId).toString()) {
      throw new BadRequestException(
        'Le message parent appartient à une autre ressource',
      );
    }
    if (parent.parentId) {
      throw new BadRequestException(
        'Un message ne peut pas répondre à une réponse (un seul niveau)',
      );
    }
    return parent._id;
  }

  private isAuthor(actor: UserDocument, authorId: Types.ObjectId): boolean {
    return actor._id.toString() === authorId.toString();
  }

  private assertCanModerate(
    actor: UserDocument,
    authorId: Types.ObjectId,
  ): void {
    if (
      !this.isAuthor(actor, authorId) &&
      !PRIVILEGED_ROLES.includes(actor.role)
    ) {
      throw new ForbiddenException(
        'Seul l\'auteur ou un responsable/administrateur peut effectuer cette action',
      );
    }
  }
}
