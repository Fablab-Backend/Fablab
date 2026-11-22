import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resource, ResourceDocument } from './resources.model';
import { CreateRoomDto, CreateEquipmentDto } from './resources.validation';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name) private resourceModel: Model<ResourceDocument>,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto): Promise<Resource> {
    const createdRoom = new this.resourceModel({
      ...createRoomDto,
      type: 'Room',
    });
    
    // TODO: Appeler le service Audit de Melvin ici
    // this.auditService.log('RESOURCE_CREATED', createdRoom._id);
    
    return createdRoom.save();
  }

  async createEquipment(createEquipmentDto: CreateEquipmentDto): Promise<Resource> {
    const createdEquipment = new this.resourceModel({
      ...createEquipmentDto,
      type: 'Equipment',
    });
    
    // TODO: Appeler le service Audit de Melvin ici
    
    return createdEquipment.save();
  }

  // Méthode de recherche avec filtres (Pour le Chatbot et l'interface)
  async findAll(query: any): Promise<Resource[]> {
    const filter: any = {};
    
    if (query.type) filter.type = query.type;
    if (query.locationId) filter.locationId = query.locationId;
    if (query.minCapacity) filter.capacity = { $gte: Number(query.minCapacity) };
    if (query.state) filter.state = query.state;

    return this.resourceModel.find(filter).exec();
  }

  async findOne(id: string): Promise<Resource> {
    const resource = await this.resourceModel.findById(id).exec();
    if (!resource) {
      throw new NotFoundException(`Ressource avec l'ID ${id} introuvable`);
    }
    return resource;
  }

  async update(id: string, updateData: any): Promise<Resource> {
    const updated = await this.resourceModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Ressource avec l'ID ${id} introuvable`);
    }
    // TODO: Audit Melvin
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.resourceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Ressource avec l'ID ${id} introuvable`);
    }
    // TODO: Audit Melvin
  }
}