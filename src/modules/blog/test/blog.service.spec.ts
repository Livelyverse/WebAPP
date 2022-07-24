import { Test, TestingModule } from "@nestjs/testing";
import { BlogService } from "../blog.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BlogEntity, ProtocolType } from "../domain/entity/blog.entity";
import { Repository } from "typeorm";

export class BlogRepositoryMock {
}

describe('BlogService', () => {
  let service: BlogService;
  let repository: Repository<BlogEntity>
  let findAndCount: jest.Mock;
  beforeEach(async () => {
    findAndCount = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: getRepositoryToken(BlogEntity),
          useValue: {
            findAndCount
          }
        },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
    repository = module.get<Repository<BlogEntity>>(getRepositoryToken(BlogEntity));
  });

  it('should findAll by jest.fn returned data', async() => {
    const result = new BlogEntity();
    result.name = "test1";
    result.protocol = ProtocolType.RSS;
    result.protocolVersion = "2.0";

    findAndCount.mockReturnValue(Promise.resolve( [[result], 1]))

    expect(await service.findAll(0, 5, "ASC"))
      .toEqual({data: [result], total: 1})
  });

  it('should findAll by jest.spyOn returned data', async() => {
    const result = new BlogEntity();
    result.name = "test1";
    result.protocol = ProtocolType.RSS;
    result.protocolVersion = "2.0";

    jest.spyOn(repository, 'findAndCount')
        .mockImplementation(async () => [[result], 1])

    expect(await service.findAll(0, 5, "ASC"))
      .toStrictEqual({data: [result], total: 1})
  });
});
