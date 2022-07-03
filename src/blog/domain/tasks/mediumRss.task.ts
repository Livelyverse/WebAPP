import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Parser from 'rss-parser';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import * as Rxjs from 'rxjs';
import { BlogEntity, ProtocolType } from '../entities/blog.entity';
import { MediumRssCreateDto } from '../dto/mediumRssCreate.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";

type MediumFeed = { generator: string };

@Injectable()
export class MediumTaskService {
  private readonly _logger = new Logger(MediumTaskService.name);
  private readonly _httpService: HttpService;
  private readonly _blogRepository: Repository<BlogEntity>;
  private readonly _xmlParser;
  private readonly _configService: ConfigService;
  private readonly _mediumRssAddress: string;

  constructor(
    readonly httpService: HttpService,
    @InjectRepository(BlogEntity)
    readonly blogRepository,
    readonly configService: ConfigService,
  ) {
    this._httpService = httpService;
    this._blogRepository = blogRepository;
    this._configService = configService;
    this._xmlParser = new Parser<MediumFeed, unknown>({
      customFields: {
        feed: ['generator'],
      },
    });
    this._mediumRssAddress = this._configService.get<string>('blog.mediumRss');
    if (!this._mediumRssAddress) {
      throw new Error("blog.mediumRss config is empty");
    }
    this.fetchMediumRss();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  fetchMediumRss() {
    // this._logger.log('Called when the current second is 1');
    // let result = await this._blogRepository.query(`select count(*) from blog where '{"guid":"test"}'::jsonb <@ feed`)
    const observer: Rxjs.Observable<BlogEntity> = this._httpService
      .get(this._mediumRssAddress)
      .pipe(
        Rxjs.map((response) => {
          const result = /<rss.*version="(.*)" (.*)/.exec(response.data);
          const blogEntity = new BlogEntity();
          blogEntity.protocolVersion = result[1];
          blogEntity.protocol = ProtocolType.RSS;
          return [blogEntity, response];
        }),
        Rxjs.concatMap((tuple: [BlogEntity, AxiosResponse]) => {
          return Rxjs.from(
            (async () => {
              return [
                tuple[0],
                await this._xmlParser.parseString(tuple[1].data),
              ];
            })(),
          );
        }),
        Rxjs.mergeMap(([blogEntityPattern, dto]: [BlogEntity, MediumRssCreateDto & MediumFeed]) => {
          let blogs: BlogEntity[] = [];
          for (const item of dto.items) {
            const blogEntity = new BlogEntity();
            blogEntity.protocolVersion = blogEntityPattern.protocolVersion;
            blogEntity.protocol = blogEntityPattern.protocol;
            blogEntity.resource = this._mediumRssAddress;
            blogEntity.name = dto.generator;
            blogEntity.domain = /^http.*\/\/(.*?)(\/.*)/.exec(dto.feedUrl)[1];
            blogEntity.title = dto.title;
            blogEntity.description = dto.description;
            blogEntity.feedUrl = dto.feedUrl;
            blogEntity.link = dto.link;
            blogEntity.publishedAt = new Date(item.isoDate);
            blogEntity.image = dto.image;
            blogEntity.feed = item;
            blogs.push(blogEntity);
          }
          return Rxjs.from(blogs)
            .pipe(
              Rxjs.zipWith(Rxjs.from(dto.items)
                .pipe(Rxjs.mergeMap((item) =>
                  Rxjs.from(this._blogRepository.query(`select count(*) from blog where '{"guid":"${item.guid}"}'::jsonb <@ feed`))
                  .pipe(
                    // Rxjs.tap((result) => this._logger.log(`query result: ${result[0].count}`)),
                    Rxjs.map((result) => parseInt(result[0].count) === 0))
                  )
                )
              ),
              Rxjs.filter(([_, isFound]) => isFound === true),
              Rxjs.mergeMap(([blog, _]) => Rxjs.from(this._blogRepository.save(blog))))
        }),
        retryWithDelay(60000, 21),
        // Rxjs.catchError((error: unknown) => {
        //   this._logger.error(`fetchMediumRss fetch RSS failed: ${error}`);
        //   return Rxjs.of(null);
        // }),
      );

    // await lastValueFrom(observer);
    observer.subscribe(
      (value: BlogEntity) => {this._logger.log(`New BlogEntity persist successfully, id: ${value.id}, title: ${value.title}`);},
      (error) => this._logger.error(`fetchMediumRss fetch RSS failed, error: ${error}`),
      () => this._logger.log(`fetchMediumRss fetch RSS completed`));

    // const parser = new Parser();
    // (async () => {
    //   const feed = await parser.parseURL('https://medium.com/feed/@sabesan96');
    //   console.log(JSON.stringify(feed)); // feed will have a `foo` property, type as a string

    // feed.items.forEach((item) => {
    //   console.log(item.title + ':' + item.link); // item will have a `bar` property type as a number
    // });
    // })();
  }

  // private dataHandler(tuple: [BlogEntity, BlogCreateDto]) : Rxjs.Observable<any> {
  //   return Rxjs.from(tuple[1].items)
  //     .pipe(Rxjs.mergeMap((item) => {
  //       this._blogRepository.query('select feed -> ')
  //     }))
  // }
}

export function retryWithDelay<T>(delay: number, count = 1): Rxjs.MonoTypeOperatorFunction<T> {
  return (input) =>
    input.pipe(
      Rxjs.retryWhen((errors) =>
        errors.pipe(
          Rxjs.scan((acc, error) => ({ count: acc.count + 1, error }), {
            count: 0,
            error: undefined as any,
          }),
          Rxjs.tap((current) => {
            if (current.count > count) {
              throw current.error;
            }
          }),
          Rxjs.delay(delay)
        )
      )
    );
}
