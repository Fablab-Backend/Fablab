import 'reflect-metadata';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { HttpException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from '../users/users.model';
import { FAQ } from './chatbot.faq';
import { ChatIntent } from './chatbot.model';
import { ChatbotService } from './chatbot.service';

const user = {
  _id: new Types.ObjectId(),
  role: UserRole.UTILISATEUR,
} as unknown as UserDocument;

// Ressources telles que renvoyées par ResourcesService.findAll (type = 'Room' | 'Equipment')
const SALLE_ALPHA = {
  _id: 'r1',
  name: 'Salle Alpha',
  type: 'Room',
  capacity: 12,
  isActive: true,
};
const SALLE_BETA = {
  _id: 'r2',
  name: 'Salle Beta',
  type: 'Room',
  capacity: 8,
  isActive: true,
};

type Resource = Record<string, unknown>;

function makeService(ai: Record<string, unknown> = {}) {
  const resourcesService = {
    findAll: mock.fn<(query?: unknown) => Promise<Resource[]>>(async () => []),
  };
  const chatModel = {
    create: mock.fn<(doc?: unknown) => Promise<unknown>>(async () => ({})),
  };
  const aiProvider = {
    enabled: false,
    complete: mock.fn<(system: string, prompt: string) => Promise<string>>(
      async () => 'Réponse IA',
    ),
    ...ai,
  };
  const service = new ChatbotService(
    chatModel as never,
    resourcesService as never,
    aiProvider as never,
  );
  return { service, resourcesService, chatModel, aiProvider };
}

describe('ChatbotService : FAQ', () => {
  it('répond à une question fréquente sans interroger les ressources', async () => {
    const { service, resourcesService, chatModel } = makeService();

    const result = await service.handleMessage(user, {
      message: 'Comment annuler une réservation ?',
    });

    assert.equal(result.intent, ChatIntent.FAQ);
    assert.equal(result.reply, FAQ.find((f) => f.id === 'annuler')!.answer);
    assert.equal(resourcesService.findAll.mock.callCount(), 0);
    assert.equal(chatModel.create.mock.callCount(), 1);
  });

  it("répond par un message d'aide quand la demande est inconnue", async () => {
    const { service } = makeService();

    const result = await service.handleMessage(user, { message: 'blabla xyz' });

    assert.equal(result.intent, ChatIntent.UNKNOWN);
    assert.match(result.reply, /salle ou un équipement/);
  });
});

describe('ChatbotService : recherche de ressources', () => {
  it('cherche des salles selon le nombre de personnes', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findAll.mock.mockImplementation(async () => [SALLE_ALPHA]);

    const result = await service.handleMessage(user, {
      message: 'Je cherche une salle pour 10 personnes',
    });

    assert.equal(result.intent, ChatIntent.SEARCH_RESOURCE);
    assert.deepEqual(resourcesService.findAll.mock.calls[0].arguments[0], {
      type: 'Room',
      minCapacity: 10,
    });
    assert.match(result.reply, /Salle Alpha/);
  });

  it('filtre sur le mot-clé du message (nom de la ressource)', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findAll.mock.mockImplementation(async () => [
      SALLE_ALPHA,
      SALLE_BETA,
    ]);

    const result = await service.handleMessage(user, { message: 'la salle Beta' });

    assert.equal(result.resources?.length, 1);
    assert.equal(result.resources?.[0].name, 'Salle Beta');
  });

  it('ne propose jamais une ressource inactive', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findAll.mock.mockImplementation(async () => [
      SALLE_ALPHA,
      { ...SALLE_BETA, isActive: false },
    ]);

    const result = await service.handleMessage(user, {
      message: 'je cherche une salle',
    });

    assert.deepEqual(
      result.resources?.map((r) => r.id),
      ['r1'],
    );
  });

  it("propose d'ouvrir le formulaire de réservation SANS réserver (confirmation requise)", async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findAll.mock.mockImplementation(async () => [SALLE_ALPHA]);

    const result = await service.handleMessage(user, {
      message: 'Je veux réserver la salle Alpha',
    });

    assert.equal(result.suggestedAction?.type, 'open_reservation_form');
    assert.equal(result.suggestedAction?.resourceId, 'r1');
    assert.equal(result.suggestedAction?.requiresConfirmation, true);
  });

  it('gère une demande de disponibilité', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findAll.mock.mockImplementation(async () => [SALLE_ALPHA]);

    const result = await service.handleMessage(user, {
      message: 'La salle Alpha est-elle disponible demain ?',
    });

    assert.equal(result.intent, ChatIntent.AVAILABILITY);
    assert.equal(result.suggestedAction?.resourceId, 'r1');
    assert.match(result.suggestedAction?.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('ChatbotService : IA', () => {
  it("utilise la réponse de l'IA quand elle est activée", async () => {
    const { service, aiProvider } = makeService({ enabled: true });

    const result = await service.handleMessage(user, {
      message: 'Comment annuler une réservation ?',
    });

    assert.equal(result.reply, 'Réponse IA');
    assert.equal(aiProvider.complete.mock.callCount(), 1);
  });

  it("retombe sur la réponse par règles quand l'IA est en panne", async () => {
    const { service, aiProvider } = makeService({ enabled: true });
    aiProvider.complete.mock.mockImplementation(async () => {
      throw new Error('IA indisponible');
    });

    const result = await service.handleMessage(user, {
      message: 'Comment annuler une réservation ?',
    });

    assert.equal(result.reply, FAQ.find((f) => f.id === 'annuler')!.answer);
  });
});

describe('ChatbotService : limite de débit', () => {
  it('refuse le 11e message dans la même minute (429)', async () => {
    const { service } = makeService();

    for (let i = 0; i < 10; i++) {
      await service.handleMessage(user, { message: 'bonjour' });
    }

    await assert.rejects(
      service.handleMessage(user, { message: 'bonjour' }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 429,
    );
  });
});
