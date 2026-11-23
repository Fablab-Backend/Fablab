# Jobs planifiés (`apps/api/src/jobs`)

Deux tâches planifiées via `@nestjs/schedule`, dédiées aux prêts (`modules/loans`).
La logique métier vit dans `LoansService` ; les classes de job ne gèrent que
l'ordonnancement et le verrou distribué.

## Jobs

| Job | Fréquence | Méthode appelée | Effet |
|-----|-----------|-----------------|-------|
| `LoanOverdueJob` | toutes les 15 min (`OVERDUE_CRON`) | `LoansService.markOverdueLoans(now)` | passe en `OVERDUE` les prêts `ACTIVE` échus ; envoie `LOAN_OVERDUE` à l'emprunteur et aux responsables, au plus une fois par jour (`overdueNotifiedAt`) |
| `LoanReminderJob` | toutes les heures (`REMINDER_CRON`) | `LoansService.findDueSoon(now, hours)` | envoie `LOAN_REMINDER` aux emprunteurs dont `dueAt` tombe dans les `LOAN_REMINDER_HOURS` prochaines heures, une seule fois (`reminderSentAt`) |

## Variables d'environnement

| Variable | Défaut | Rôle |
|----------|--------|------|
| `REDIS_URL` | — | URL Redis pour les verrous distribués. Vide → les jobs journalisent un avertissement et sautent chaque cycle (l'API continue de démarrer). |
| `OVERDUE_CRON` | `*/15 * * * *` | Expression cron du job de retard. |
| `REMINDER_CRON` | `0 * * * *` | Expression cron du job de rappel. |
| `LOAN_REMINDER_HOURS` | `24` | Fenêtre (en heures) pour les rappels d'échéance. |

> Les expressions cron sont lues au chargement des décorateurs : utiliser de
> vraies variables d'environnement si elles doivent être surchargées.

## Multi-instances

L'API peut tourner sur plusieurs instances derrière nginx. Chaque exécution de
job acquiert un verrou Redis avant de travailler :

- `SET fablab:job-lock:<job> <token> PX <ttl> NX` — une clé par job, TTL
  supérieur à la durée du job (10 min pour overdue, 30 min pour reminder).
- Libération par script Lua qui ne supprime la clé que si la valeur est
  toujours le token de l'instance (pas de suppression d'un verrou repris
  après expiration du TTL).
- Verrou déjà pris ou Redis indisponible → le cycle est sauté silencieusement
  (avertissement journalisé une fois), sans exception.

Côté base, les écritures sont idempotentes : les passages en `OVERDUE` et les
notifications sont protégés par des `updateOne` atomiques filtrés sur
`overdueNotifiedAt` / `reminderSentAt`, donc une double exécution accidentelle
ne peut pas envoyer deux notifications.

## Infra

`infra/compose.yaml` contient déjà un service `redis:7` exposé sur `6379` ;
il suffit de renseigner `REDIS_URL=redis://localhost:6379` (adapter l'hôte en
déploiement). Aucune modification d'`infra/` n'est requise pour ce module.
