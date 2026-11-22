import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { getModelToken } from '@nestjs/mongoose';
import { Resource } from './resources.model';

describe('ResourcesService', () => {
  let service: ResourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        {
          provide: getModelToken(Resource.name),
          useValue: {}, // Mock basique du modèle Mongoose
        },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });
});