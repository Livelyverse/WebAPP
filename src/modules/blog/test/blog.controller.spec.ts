import { Test, TestingModule } from '@nestjs/testing';
import { BlogController } from '../blog.controller';
import { BlogService } from '../blog.service';
import { BlogEntity } from "../domain/entity/blog.entity";
import { HttpException, HttpStatus } from "@nestjs/common";

describe('BlogController', () => {
  let controller: BlogController;
  let service: BlogService;

  beforeEach(async () => {

    const serviceProvider = {
      provide: BlogService,
      useFactory: () => ({
        findAll: jest.fn((offset, limit: number, sortType: "ASC" | "DESC") => ({data: [new BlogEntity()], total: 1}))
      })
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [serviceProvider],
    }).compile();

    controller = module.get<BlogController>(BlogController);
    service = module.get<BlogService>(BlogService);
  });

  it('should service.findAll method called', () => {

    // when
    controller.findAll(1,5, "asc");

    // then
    expect(service.findAll).toHaveBeenCalled();
    expect(service.findAll).toHaveBeenCalledWith(0, 5 ,"ASC");
  });

  it('should controller.findAll raise validation exceptions',  async () => {

    // when and then
    await expect(controller.findAll(-1,5, "asc")).rejects
      .toThrow('Page Data Invalid');

    await expect(controller.findAll(-1,5, "asc")).rejects
      .toThrowError(new HttpException('Page Data Invalid', HttpStatus.BAD_REQUEST));

    await expect(controller.findAll(1,-5, "asc")).rejects
      .toThrowError(new HttpException('Offset Data Invalid', HttpStatus.BAD_REQUEST));

    await expect(controller.findAll(1,5, "ASCD")).rejects
      .toThrowError(new HttpException('SortType Data Invalid', HttpStatus.BAD_REQUEST));
  });
});
