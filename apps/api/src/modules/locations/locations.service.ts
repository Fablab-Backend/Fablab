import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Location, LocationDocument } from './locations.model';
import { CreateLocationDto } from './locations.validation';

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
  ) {}

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const createdLocation = new this.locationModel(createLocationDto);
    // TODO: Audit Melvin
    return createdLocation.save();
  }

  async findAll(query: any): Promise<Location[]> {
    const filter: any = {};
    if (query.organizationId) {
      filter.organizationId = query.organizationId;
    }
    // Permet de filtrer par type (ex: ?type=Bâtiment)
    if (query.type) {
      filter.type = query.type;
    }
    return this.locationModel.find(filter).exec();
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locationModel.findById(id).exec();
    if (!location) {
      throw new NotFoundException(`Lieu avec l'ID ${id} introuvable`);
    }
    return location;
  }
}