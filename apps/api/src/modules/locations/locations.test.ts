import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { getModelToken } from '@nestjs/mongoose';
import { Location } from './locations.model';

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: getModelToken(Location.name),
          useValue: {}, // Mock basique du modèle Mongoose pour le test
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });
});