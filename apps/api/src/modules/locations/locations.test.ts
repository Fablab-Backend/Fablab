import 'reflect-metadata';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { getModelToken } from '@nestjs/mongoose';
import { Location } from './locations.model';

describe('LocationsService', () => {
  let service: LocationsService;

  before(async () => {
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
    assert.ok(service);
  });
});