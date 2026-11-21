import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDocument } from '../../modules/users/users.model';

/** Injecte l'utilisateur authentifié (request.user) dans un handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
