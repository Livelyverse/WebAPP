import {
  Controller,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
  Query, HttpException
} from "@nestjs/common";
import { BlogService } from './blog.service';
import { ApiQuery, ApiResponse } from "@nestjs/swagger";
import { FindAllViewDto } from "./domain/dto/findAllView.dto";

@Controller('/api/blog')
export class BlogController {
  private readonly _logger = new Logger(BlogController.name);
  constructor(private readonly blogService: BlogService) {}

  @Get('/findAll')
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
    required: true,
    description: 'data sort type can be one of ASC or DESC',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findAll(
    @Query('page') page,
    @Query('offset') offset,
    @Query('sortType') sortType,
  ): Promise<FindAllViewDto> {
    if (page <= 0) {
      throw new HttpException(
        { message: 'Page Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (offset <= 0) {
      throw new HttpException(
        { message: 'Offset Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (sortType.toUpperCase() !== 'DESC' && sortType.toUpperCase() !== 'ASC') {
      throw new HttpException(
        { message: 'SortType Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const {data, total}  = await this.blogService.findAll((page - 1) * offset, offset, sortType.toUpperCase());
    if (total === 0 || data.length === 0) {
      throw new HttpException('Blogs Not Found' , HttpStatus.NOT_FOUND);
    }

    const totalPage = Math.ceil(total / offset);
    return FindAllViewDto.from(page, offset, total, totalPage, data)
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.blogService.findOne(+id);
  // }
  //
  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateBlogDto: MediumRssViewDto) {
  //   return this.blogService.update(+id, updateBlogDto);
  // }
  //
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.blogService.remove(+id);
  // }
}
