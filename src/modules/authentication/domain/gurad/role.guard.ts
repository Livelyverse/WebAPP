import { CanActivate, ExecutionContext, mixin, Type } from '@nestjs/common';
import { UserEntity } from "../../../profile/domain/entity";

const RoleGuard = (role: string): Type<CanActivate> => {
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest() as any;
      const user = req.user as UserEntity;
      return user?.userGroup?.role?.name === role.toUpperCase();
    }
  }

  return mixin(RoleGuardMixin);
};

export default RoleGuard;
