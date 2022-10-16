import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BlogEntity } from "./domain/entity/blog.entity";
import { Repository } from "typeorm";
import { FindAllType, SortType } from "../profile/services/IService";

@Injectable()
export class BlogService {
  private readonly _logger = new Logger(BlogService.name);
  private readonly _blogRepository: Repository<BlogEntity>;

  constructor(@InjectRepository(BlogEntity) readonly blogRepository) {
    this._blogRepository = blogRepository;
  }

  async findAll(offset, limit: number, sortType: SortType): Promise<FindAllType<BlogEntity>> {
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
      this._logger.error(`_blogRepository.findAndCount failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
