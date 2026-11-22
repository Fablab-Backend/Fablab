
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentMetadata, DocumentMetadataDocument } from './files.model';

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(DocumentMetadata.name) private fileModel: Model<DocumentMetadataDocument>,
  ) {}

  async saveFileMetadata(file: any, resourceId?: string): Promise<DocumentMetadata> 
  {
    const newFile = new this.fileModel({
      originalName: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
      resourceId: resourceId || null,
    });
    
    // TODO: Audit Melvin (ex: this.auditService.log('FILE_UPLOADED', newFile._id))
    
    return newFile.save();
  }
}