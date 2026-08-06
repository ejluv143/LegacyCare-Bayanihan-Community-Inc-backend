import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

interface AdminRoleRequest {
  user?: {
    role?: string;
    accountType?: string;
  };
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRoleRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (user.role !== 'admin' || user.accountType !== 'admin') {
      throw new ForbiddenException('An administrator account is required.');
    }

    return true;
  }
}
