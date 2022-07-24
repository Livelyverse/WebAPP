import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Parser from 'rss-parser';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import * as Rxjs from 'rxjs';
import { BlogEntity, ProtocolType } from '../entity/blog.entity';
import { MediumRssCreateDto } from '../dto/mediumRssCreate.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from "typeorm";
import { DatabaseError } from 'pg-protocol';
import { ConfigService } from "@nestjs/config";
import { TypeORMError } from "typeorm/error/TypeORMError";

type MediumFeed = { generator: string, thumbnail: string };
type ThumbnailFeed = {guid: string, thumbnail: string};

export const isQueryFailedError = (err: unknown): err is QueryFailedError & DatabaseError =>
  err instanceof QueryFailedError;

@Injectable()
export class MediumTaskService {
  private readonly _logger = new Logger(MediumTaskService.name);
  private readonly _httpService: HttpService;
  private readonly _blogRepository: Repository<BlogEntity>;
  private readonly _xmlParser;
  private readonly _configService: ConfigService;
  private readonly _mediumRssAddress: string;
  private readonly _mediumThumbnailAddress: string;

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
    this._mediumRssAddress = this._configService.get<string>('blog.medium.rss');
    if (!this._mediumRssAddress) {
      throw new Error("blog.medium.rss config is empty");
    }

    this._mediumThumbnailAddress = this._configService.get<string>('blog.medium.thumbnail');
    if (!this._mediumThumbnailAddress) {
      throw new Error("blog.medium.thumbnail config is empty");
    }
    this.fetchMediumRss();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  fetchMediumRss() {
    // this._logger.log('Called when the current second is 1');
    // let result = await this._blogRepository.query(`select count(*) from blog where '{"guid":"test"}'::jsonb <@ feed`)
    // const observer: Rxjs.Observable<BlogEntity> = this._httpService
    const observer = this._httpService
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
        Rxjs.zipWith(this._httpService
          .get(this._mediumThumbnailAddress)
          .pipe(Rxjs.map(response => {
              let thumbnailItems: Array<ThumbnailFeed> = [];
              for (const {guid, thumbnail} of response.data.items) {
                thumbnailItems.push({guid: guid, thumbnail: thumbnail});
              }
              return thumbnailItems;
            }),
            retryWithDelay(10000, 3),
          )
        ),
        Rxjs.map(tuple => [...tuple[0], tuple[1]]),
        Rxjs.mergeMap(([blogEntityPattern, dto, thumbnailItems]: [BlogEntity, MediumRssCreateDto & MediumFeed, [ThumbnailFeed]]) => {
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
            for (const thumbnailItem of thumbnailItems) {
              if (item.guid === thumbnailItem.guid) {
                blogEntity.thumbnail = thumbnailItem.thumbnail;
                dto.thumbnail = thumbnailItem.thumbnail;
                break;
              }
            }
            blogs.push(blogEntity);
          }
          return Rxjs.from(blogs);
        }),
        Rxjs.mergeMap((newBlog) => {
            return Rxjs.zip(Rxjs.of(newBlog), Rxjs.from(this._blogRepository.query(`select * from blog where '{"guid":"${newBlog.feed.guid}"}'::jsonb <@ feed`)));
        }),
        Rxjs.mergeMap((tuple) => {
          let [newBlog, result] = tuple;
          if (result && result.length > 0) {
            // this._logger.log(`query result entity found: ${result[0].feed.guid}`);
            const fetchedBlog = result[0];
            if (newBlog.title === fetchedBlog.title &&
                newBlog.feed.link === fetchedBlog.feed.link &&
                newBlog.thumbnail === fetchedBlog.thumbnail) {
              return Rxjs.of(null);
            }
            return Rxjs.from(this._blogRepository.update({ id: fetchedBlog.id }, { title: newBlog.title, thumbnail: newBlog.thumbnail, feed: newBlog.feed }))
              .pipe(
                // Rxjs.tap(result => this._logger.log(`update result: ${JSON.stringify(result)}`)),
                Rxjs.map(_ => newBlog)
              );
          } else {
            // this._logger.log(`query result blog not found, new Blog: ${newBlog.feed.guid}`);
            return Rxjs.from(this._blogRepository.save(newBlog));
          }
        }),
        retryWithDelay(10000, 3),
      );

    // await lastValueFrom(observer);
    observer.subscribe(
      (value: BlogEntity) => {
        if(value) {
          if (value.id) {
            this._logger.log(`New BlogEntity persist successfully, guid: ${value.feed.guid}, title: ${value.title}`);
          } else {
            this._logger.log(`BlogEntity update successfully, guid: ${value.feed.guid}, title: ${value.title}`);
          }
        }},
      // (value) => {this._logger.log(`New BlogEntity persist successfully, ${value}`);},
      (error) => this._logger.error(`fetchMediumRss fetch RSS failed, error: ${error}`),
      () => this._logger.log(`fetchMediumRss fetch RSS completed`));
  }
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
            if (current.error instanceof TypeORMError || current.count > count) {
              throw current.error;
            }
          }),
          Rxjs.delay(delay)
        )
      )
    );
}
