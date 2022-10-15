import { ApiResponseProperty } from "@nestjs/swagger";
import { FindAllBalanceType } from "../../services/airdrop.service";
import { AirdropBalance, AirdropBalanceViewDto } from "./airdropBalanceView.dto";

export class FindAllBalanceViewDto {

  public static from(
    page: number,
    offset: number,
    totalCount: number,
    totalPage: number,
    entities: AirdropBalance[],
  ): FindAllBalanceViewDto {
    const findAllBalanceDto = new FindAllBalanceViewDto();
    findAllBalanceDto.page = page;
    findAllBalanceDto.offset = offset;
    findAllBalanceDto.totalCount = totalCount;
    findAllBalanceDto.totalPage = totalPage;

    findAllBalanceDto.data = entities.map(entity => AirdropBalanceViewDto.from(entity))
      .reduce((acc, view) => [...acc, view], []);
    return findAllBalanceDto;
  }

  @ApiResponseProperty()
  public page: number;

  @ApiResponseProperty()
  public offset: number;

  @ApiResponseProperty()
  public totalPage: number;

  @ApiResponseProperty()
  public totalCount: number;

  @ApiResponseProperty()
  public data: AirdropBalanceViewDto[];
}