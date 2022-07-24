import { CanActivate, ExecutionContext, mixin, Type } from '@nestjs/common';

const RoleGuard = (role: string): Type<CanActivate> => {
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest() as any;
      const user = req.user;
      return user?.group.role.name === role.toUpperCase();
    }
  }

  return mixin(RoleGuardMixin);
};

export default RoleGuard;
