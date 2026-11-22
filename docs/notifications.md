# Module notifications

Module NestJS (`apps/api/src/modules/notifications`) chargé de la création et de la
consultation des notifications utilisateurs (collection MongoDB `notifications`).

## `NotificationsService.notify`

Point d'entrée unique pour tout le backend : les autres modules (loans,
reservations, jobs, etc.) l'appellent pour notifier un utilisateur.

```ts
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.model';

@Injectable()
export class LoansService {
  constructor(private readonly notifications: NotificationsService) {}

  async createLoan(userId: string, loanId: string) {
    // ... création du prêt ...
    await this.notifications.notify({
      userId,
      type: NotificationType.LOAN_CREATED,
      title: 'Prêt créé',
      message: 'Votre demande de prêt a été enregistrée.',
      data: { loanId },
      channels: ['in_app', 'email'],
      email: 'user@example.com',
    });
  }
}
```

Pour utiliser le service, importer `NotificationsModule` dans le module appelant
(le service est exporté par le module) :

```ts
@Module({
  imports: [NotificationsModule],
  // ...
})
export class LoansModule {}
```

### Signature

```ts
async notify(input: {
  userId: string;                                  // ObjectId de l'utilisateur cible
  type: NotificationType;                          // voir la liste ci-dessous
  title: string;
  message: string;
  data?: Record<string, unknown>;                  // ex. { loanId, reservationId, resourceId }
  channels?: Array<'in_app' | 'email'>;            // défaut : ['in_app']
  email?: string;                                  // destinataire si 'email' est demandé
}): Promise<NotificationDocument>
```

### Types disponibles (`NotificationType`)

| Type | Déclencheur typique |
| --- | --- |
| `REQUEST_CREATED` | Une demande (prêt, réservation…) est créée |
| `REQUEST_VALIDATED` | Une demande est validée par un manager/admin |
| `REQUEST_REJECTED` | Une demande est refusée |
| `LOAN_CREATED` | Un prêt est créé |
| `LOAN_RETURNED` | Un prêt est retourné |
| `LOAN_REMINDER` | Rappel avant échéance de retour |
| `LOAN_OVERDUE` | Prêt en retard |
| `RESERVATION_CONFIRMED` | Une réservation est confirmée |
| `RESERVATION_CANCELLED` | Une réservation est annulée |

## Garanties

- **Un échec d'envoi de courriel ne fait jamais échouer l'appelant.** L'erreur est
  capturée et journalisée, et la notification est enregistrée avec
  `emailStatus = 'failed'`. Seule une erreur de création en base peut remonter.
- Après création, l'événement `notification.created` est émis via `EventEmitter2`
  (quand le module events est disponible) pour les besoins du temps réel.
- `emailStatus` vaut `not_requested` | `sent` | `failed`.

## `GET /api/notifications`

Retourne les notifications de l'utilisateur connecté, triées de la plus récente à
la plus ancienne.

| Paramètre | Défaut | Description |
| --- | --- | --- |
| `page` | `1` | Page demandée (entier ≥ 1) |
| `limit` | `20` | Taille de page (entier ≥ 1, max `100`) |
| `unreadOnly` | `false` | `true` pour ne renvoyer que les non lues |

Réponse : `{ items, total, page, limit }`.

## Configuration e-mail

Le `Mailer` est injectable via le token `MAILER` :

- Si `SMTP_HOST`, `SMTP_USER` et `SMTP_PASS` sont définis → envoi SMTP réel
  (nodemailer, expéditeur `MAIL_FROM`).
- Sinon → `LogMailer`, qui journalise le courriel au lieu de l'envoyer
  (utile en développement et dans les tests).

Variables à renseigner dans `.env` : `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`.
