import { ApiResponseProperty } from "@nestjs/swagger";

export interface AirdropBalance {
  total: bigint;
  pending: bigint;
  settlement: bigint;
  username?: string;
  userId?: string;
}

export class AirdropBalanceViewDto {
  static from(entity: AirdropBalance): AirdropBalanceViewDto | null {
    if(entity) {
      const balanceDto = new AirdropBalanceViewDto();
      balanceDto.total = entity.total.toString();
      balanceDto.pending = entity.pending.toString();
      balanceDto.settlement = entity.settlement.toString();
      balanceDto.username = entity?.username;
      balanceDto.userId = entity?.userId;
      return balanceDto;
    }
    return null;
  }

  @ApiResponseProperty()
  total: string;

  @ApiResponseProperty()
  pending: string;

  @ApiResponseProperty()
  settlement: string;

  @ApiResponseProperty()
  username?: string;

  @ApiResponseProperty()
  userId?: string;
}