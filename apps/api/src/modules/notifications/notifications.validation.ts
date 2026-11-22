import { BadRequestException } from '@nestjs/common';

export interface ListNotificationsQuery {
  page: number;
  limit: number;
  unreadOnly: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parseListNotificationsQuery(raw: Record<string, unknown>): ListNotificationsQuery {
  const page = parsePositiveInt(raw.page, DEFAULT_PAGE, 'page');
  const limit = parsePositiveInt(raw.limit, DEFAULT_LIMIT, 'limit');
  if (limit > MAX_LIMIT) {
    throw new BadRequestException(`limit must be less than or equal to ${MAX_LIMIT}`);
  }
  return { page, limit, unreadOnly: parseBoolean(raw.unreadOnly, 'unreadOnly') };
}

function parsePositiveInt(value: unknown, defaultValue: number, field: string): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new BadRequestException(`${field} must be a boolean`);
}
