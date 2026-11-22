import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { FilesService } from './files.service';

// Configuration de Multer pour stocker dans le dossier /uploads avec un nom unique
export const multerConfig = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo maximum par fichier
};

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('resourceId') resourceId?: string,
  ) {
    return this.filesService.saveFileMetadata(file, resourceId);
  }
}