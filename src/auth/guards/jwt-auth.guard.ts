import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard(
  "jwt",
) {
  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    void info;
    void context;

    if (error instanceof Error) {
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException(
        "Authentication is required.",
      );
    }

    return user;
  }
}