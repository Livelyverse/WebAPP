import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { MediumRssCreateDto } from './domain/dto/mediumRssCreate.dto';
import { MediumRssViewDto } from './domain/dto/mediumRssView.dto';
import { InjectRepository } from "@nestjs/typeorm";
import { BlogEntity } from "./domain/entity/blog.entity";
import { Repository } from "typeorm";

@Injectable()
export class BlogService {
  private readonly _logger = new Logger(BlogService.name);
  private readonly _blogRepository: Repository<BlogEntity>;

  constructor(@InjectRepository(BlogEntity) readonly blogRepository) {
    this._blogRepository = blogRepository;

  }

  async findAll(offset, limit: number, sortType: "ASC" | "DESC"): Promise<{data: Array<BlogEntity>, total: number} | null> {
    try {
      const res = await this._blogRepository.findAndCount({
        skip: offset,
        take: limit,
        order: {
          ["publishedAt"]: sortType,
        },
      });

      return {
        data: res[0],
        total: res[1],
      }
    } catch (err) {
      this._logger.error(`blogRepository.findAndCount failed`, err);
      throw new HttpException("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // findOne(id: number) {
  //   return `This action returns a #${id} blog`;
  // }
  //
  // update(id: number, updateBlogDto: MediumRssViewDto) {
  //   return `This action updates a #${id} blog`;
  // }
  //
  // remove(id: number) {
  //   return `This action removes a #${id} blog`;
  // }
}
