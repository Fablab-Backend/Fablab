import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
};

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // @UseGuards(AuthGuard) <-- À décommenter plus tard
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('resourceId') resourceId?: string,
  ) {
    return this.filesService.saveFileMetadata(file, resourceId);
  }
}