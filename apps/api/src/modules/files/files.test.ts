import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { getModelToken } from '@nestjs/mongoose';
import { DocumentMetadata } from './files.model';

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getModelToken(DocumentMetadata.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });
});