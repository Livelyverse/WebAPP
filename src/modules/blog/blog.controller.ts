import {
  Controller,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
  Query, HttpException
} from "@nestjs/common";
import { BlogService } from './blog.service';
import { ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { FindAllViewDto } from "./domain/dto/findAllView.dto";
import { SortType } from "../profile/services/IService";
import { PaginationPipe } from "../profile/domain/pipe/paginationPipe";
import { EnumPipe } from "../profile/domain/pipe/enumPipe";

@ApiTags('/api/blogs')
@Controller('/api/blogs')
export class BlogController {
  private readonly _logger = new Logger(BlogController.name);
  constructor(private readonly _blogService: BlogService) {}

  @Get('/find/all')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'data page',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    description: 'data offset',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
  ): Promise<FindAllViewDto> {

    const {data, total}  = await this._blogService.findAll((page - 1) * offset, offset, sortType);
    if (total === 0 || data.length === 0) {
      throw new HttpException({
        statusCode: '404',
        message: 'Roles Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    const totalPage = Math.ceil(total / offset);
    return FindAllViewDto.from(page, offset, total, totalPage, data)
  }
}
