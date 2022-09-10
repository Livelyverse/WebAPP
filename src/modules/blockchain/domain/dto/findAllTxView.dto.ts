import { ApiProperty, ApiResponseProperty } from "@nestjs/swagger";
import { BlockchainTxViewDto } from "./blockchainTxView.dto";
import { BlockchainTxEntity } from "../entity/blockchainTx.entity";

export class FindAllTxViewDto {

  public static from(
    page: number,
    offset: number,
    totalCount: number,
    totalPage: number,
    entities: BlockchainTxEntity[],
  ): FindAllTxViewDto | null {
    const findAllDto = new FindAllTxViewDto();
    findAllDto.page = page;
    findAllDto.offset = offset;
    findAllDto.totalCount = totalCount;
    findAllDto.totalPage = totalPage;
    findAllDto.data = entities
      .map(entity => BlockchainTxViewDto.from(entity))
      .reduce((acc, view) => [...acc, view], []);
    return findAllDto;
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
  public data: BlockchainTxViewDto[];
}