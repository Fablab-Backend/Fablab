import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resource, ResourceSchema } from './resources.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: Resource.name, schema: ResourceSchema }])],
})
export class ResourcesModule {}