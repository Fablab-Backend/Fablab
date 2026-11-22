import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from './organizations.model';
import { CreateOrganizationDto } from './organizations.validation';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) {}

  async create(createOrgDto: CreateOrganizationDto): Promise<Organization> {
    const createdOrg = new this.orgModel(createOrgDto);
    // TODO: Appeler l'AuditService de Melvin
    return createdOrg.save();
  }

  async findAll(): Promise<Organization[]> {
    return this.orgModel.find().exec();
  }

  async findOne(id: string): Promise<Organization> {
    const org = await this.orgModel.findById(id).exec();
    if (!org) {
      throw new NotFoundException(`Organisation avec l'ID ${id} introuvable`);
    }
    return org;
  }
}