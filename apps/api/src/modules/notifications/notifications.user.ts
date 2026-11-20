import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

// TODO(auth): replace this local interface and decorator with the JWT guard
// and the @CurrentUser() decorator from the auth module once it lands on main.
export interface AuthenticatedUser {
  id: string;
  role: 'user' | 'manager' | 'admin';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);
