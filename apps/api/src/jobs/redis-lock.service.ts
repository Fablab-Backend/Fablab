import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Verrou distribué Redis (SET NX PX) pour éviter qu'un même job planifié
 * s'exécute en double quand l'API tourne sur plusieurs instances.
 * Si Redis est indisponible ou non configuré, acquire() renvoie null :
 * l'appelant saute le cycle sans faire planter l'application.
 */
@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private client?: Redis;
  private warnedUnavailable = false;

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }
    try {
      const token = randomUUID();
      const result = await client.set(
        this.redisKey(key),
        token,
        'PX',
        ttlMs,
        'NX',
      );
      return result === 'OK' ? token : null;
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async release(key: string, token: string): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    try {
      // Ne supprime la clé que si la valeur est toujours la nôtre (TTL expiré
      // puis verrou repris par une autre instance entre-temps).
      await client.eval(RELEASE_SCRIPT, 1, this.redisKey(key), token);
    } catch (error) {
      this.logger.warn(
        `Impossible de libérer le verrou ${key}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
      this.client = undefined;
    }
  }

  protected createClient(url: string): Redis {
    return new Redis(url, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });
  }

  private async getClient(): Promise<Redis | null> {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.warnUnavailable(null);
      return null;
    }
    if (!this.client) {
      this.client = this.createClient(url);
      this.client.on('error', (error: Error) => {
        this.warnUnavailable(error);
      });
    }
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect();
      }
      return this.client;
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  private warnUnavailable(error: unknown): void {
    if (this.warnedUnavailable) {
      return;
    }
    this.warnedUnavailable = true;
    this.logger.warn(
      'Redis indisponible : les jobs planifiés sont sautés pour ce cycle',
      error instanceof Error ? error.message : String(error ?? ''),
    );
  }

  private redisKey(key: string): string {
    return `fablab:job-lock:${key}`;
  }
}
