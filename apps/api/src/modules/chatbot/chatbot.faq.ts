export interface FaqEntry {
  id: string;
  /** Mots-clés sans accents, en minuscules. */
  keywords: string[];
  answer: string;
}

/** Texte en minuscules et sans accents, pour comparer sans se soucier de l'orthographe. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Les plus spécifiques d'abord (en cas d'égalité, la première entrée gagne).
 * IMPORTANT : adapter les réponses aux règles réelles du document avant la démo.
 */
export const FAQ: FaqEntry[] = [
  {
    id: 'annuler',
    keywords: ['annuler', 'annulation'],
    answer:
      "Vous pouvez annuler une de vos réservations depuis la liste de vos réservations, tant qu'elle n'a pas commencé.",
  },
  {
    id: 'retard',
    keywords: ['retard', 'rendre', 'retour'],
    answer:
      "Le matériel emprunté doit être rendu à la date de retour prévue. En cas de retard, une notification est envoyée et le prêt est signalé comme en retard.",
  },
  {
    id: 'emprunter',
    keywords: ['emprunter', 'emprunt', 'pret'],
    answer:
      "Pour emprunter du matériel : choisissez l'équipement dans la liste des ressources et faites une demande de prêt. Un responsable peut avoir à la valider.",
  },
  {
    id: 'reserver',
    keywords: ['reserver', 'reservation'],
    answer:
      "Pour réserver une salle : choisissez-la dans la liste des ressources, sélectionnez un créneau libre, puis validez. Selon la salle, un responsable peut devoir approuver la demande.",
  },
  {
    id: 'compte',
    keywords: ['mot de passe', 'connexion', 'compte'],
    answer:
      "Vous pouvez modifier votre profil et votre mot de passe depuis votre compte. En cas de problème de connexion, contactez un administrateur.",
  },
];