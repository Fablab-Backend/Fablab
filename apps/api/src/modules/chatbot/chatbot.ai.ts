/** Fournisseur d'IA appelé UNIQUEMENT depuis le backend. */
export interface AiProvider {
  readonly enabled: boolean;
  complete(system: string, userPrompt: string): Promise<string>;
}

export const AI_PROVIDER = 'AI_PROVIDER';

/** Utilisé quand AI_API_KEY est absente : le chatbot répond alors par règles. */
export class NoopAiProvider implements AiProvider {
  readonly enabled = false;
  async complete(): Promise<string> {
    throw new Error('IA non configurée');
  }
}

/**
 * Implémentation pour l'API Anthropic. Si votre clé vient d'un autre fournisseur,
 * seul ce fichier est à adapter (URL, en-têtes, format de la réponse).
 */
export class AnthropicProvider implements AiProvider {
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(system: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Fournisseur IA : HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new Error('Réponse IA vide');
    }
    return text;
  }
}

export function createAiProvider(): AiProvider {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return new NoopAiProvider();
  }
  return new AnthropicProvider(apiKey, process.env.AI_MODEL ?? 'claude-haiku-5-5');
}