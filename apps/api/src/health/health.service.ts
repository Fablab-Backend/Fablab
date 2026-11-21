import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export type DependencyStatus = 'up' | 'down';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async check() {
    const mongo = await this.pingMongo();
    const status = mongo === 'up' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        mongodb: mongo,
      },
    };
  }

  private async pingMongo(): Promise<DependencyStatus> {
    try {
      await this.connection.db?.admin().ping();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
