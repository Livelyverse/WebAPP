import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { FollowerError } from "../../error/follower.error";
import { Observable } from "rxjs";
import { InstagramPostDto } from "../../dto/instagramPost.dto";
import { TweetEventDto } from "../../dto/tweetEvent.dto";
import { SocialEventEntity } from "../../entity/socialEvent.entity";
import { ContentDto } from "../../dto/content.dto";
import * as moment from "moment";
import { SocialAirdropScheduleEntity } from "../../entity/socialAirdropSchedule.entity";


@Injectable()
export class PostTrackerJob {
  private readonly _logger = new Logger(PostTrackerJob.name);
  private readonly _apiKey: string;
  private readonly _apiHost: string;
  private readonly _commentFilter: string;
  private readonly _airdropFilter: string;
  private readonly _followFilter: string;
  private readonly _commentFilterRegex: RegExp;
  private readonly _airdropFilterRegex: RegExp;
  private readonly _followFilterRegex: RegExp;
  private readonly _trackerDuration: number;
  private readonly _trackerInterval: number;
  private readonly _startAt: Date;
  private readonly _FETCH_COUNT = 50;
  private readonly _apiDelay: number;

  constructor(
    private readonly _httpService: HttpService,
    private readonly _configService: ConfigService,
    private readonly _schedulerRegistry: SchedulerRegistry,
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
  ) {
    this._apiKey = this._configService.get<string>('airdrop.instagram.apiKey');
    if (!this._apiKey) {
      throw new Error("airdrop.instagram.apiKey config is empty");
    }

    this._apiHost = this._configService.get<string>('airdrop.instagram.apiHost');
    if (!this._apiHost) {
      throw new Error("airdrop.instagram.apiHost config is empty");
    }

    this._commentFilter = this._configService.get<string>('airdrop.instagram.commentFilter');
    if (!this._commentFilter) {
      throw new Error("airdrop.instagram.commentFilter config is empty");
    }

    this._airdropFilter = this._configService.get<string>('airdrop.instagram.airdropFilter');
    if (!this._airdropFilter) {
      throw new Error("airdrop.instagram.airdropFilter config is empty");
    }

    this._followFilter = this._configService.get<string>('airdrop.instagram.followFilter');
    if (!this._airdropFilter) {
      throw new Error("airdrop.instagram.followFilter config is empty");
    }

    this._trackerDuration = this._configService.get<number>('airdrop.instagram.tracker.duration');
    if (!this._trackerDuration) {
      throw new Error("airdrop.instagram.tracker.duration config is empty");
    }

    this._trackerInterval = this._configService.get<number>('airdrop.instagram.tracker.interval');
    if (!this._trackerInterval) {
      throw new Error("airdrop.instagram.tracker.interval config is empty");
    }

    this._airdropFilterRegex = new RegExp(this._airdropFilter, 'g');
    this._commentFilterRegex = new RegExp(this._commentFilter, 'g');
    this._followFilterRegex = new RegExp(this._followFilter, 'g');
    this._apiDelay = this._configService.get<number>('airdrop.instagram.apiDelay');

    const startTimestamp = this._configService.get<number>('airdrop.instagram.startAt');
    this._startAt = new Date(startTimestamp);

    const interval = setInterval(this.fetchPostFromPage.bind(this), this._trackerInterval);
    this._schedulerRegistry.addInterval('InstagramPostsTrackerJob', interval);
    this.fetchPostFromPage();
  }

  private fetchPostFromPage() {

    const airdropScheduleQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropScheduleEntity, "airdropSchedule")
      .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
      .where('"socialLively"."socialType" = \'INSTAGRAM\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .andWhere('"airdropSchedule"."airdropEndAt" > NOW()')
      .getOneOrFail())
      .pipe(
        RxJS.tap((airdropSchedule) => this._logger.debug(`fetch airdropSchedule success, socialType: ${airdropSchedule.socialLively.socialType}`)),
        RxJS.catchError(err => RxJS.throwError(() => new FollowerError('fetch INSTAGRAM airdrop schedule failed', err)))
      )

    RxJS.from(airdropScheduleQueryResultObservable).pipe(
      RxJS.mergeMap(airdropSchedule => this._fetchLivelyPosts(airdropSchedule)),
      RxJS.concatMap(([airdropSchedule, response]) =>
        // RxJS.merge(
        //   RxJS.of([socialLively, response]).pipe(
        //     RxJS.filter(tuple =>
        //       response?.data?.data?.edges && response?.data?.data?.edges?.length > 0
        //
        //     )
        //   )
        // )

        RxJS.from(response.data.data.edges).pipe(
          RxJS.filter((edge: any) => edge?.node?.edge_media_to_caption?.edges[0]?.node?.text?.match(this._airdropFilterRegex)),
          RxJS.map(edge => {
            const postDto = InstagramPostDto.from(edge);
            const socialEvent = new SocialEventEntity();
            socialEvent.contentId = postDto.id;
            socialEvent.content = ContentDto.from(postDto);
            socialEvent.lang = null;
            socialEvent.publishedAt = postDto?.createdAt ? new Date(postDto.createdAt * 1000) : new Date();
            socialEvent.contentUrl = 'https://www.instagram.com/p/' +  postDto.shortcode;
            // socialEvent.trackingStartedAt = moment().toDate();
            // socialEvent.trackingEndAt = moment().add(this._trackerDuration, 'seconds').toDate();
            socialEvent.airdropSchedule = airdropSchedule;
            return socialEvent;
          })
        )
      )
    ).subscribe({
      next: value => this._logger.log(`socialEvent, id: ${value.contentId}, url: ${value.contentUrl} `),
      error: err => this._logger.error(`error`, err),
      complete: () => this._logger.log(`complete . . .`)
    })
  }

  private _fetchLivelyPosts(airdropSchedule: SocialAirdropScheduleEntity): Observable<any> {
    return this._httpService.get(`https://instagram188.p.rapidapi.com/userpost/${airdropSchedule.socialLively.userId}/${this._FETCH_COUNT}/%7Bend_cursor%7D`, {
      headers: {
        'X-RapidAPI-Key': this._apiKey,
        'X-RapidAPI-Host': this._apiHost
      }
    }).pipe(
      RxJS.expand(response =>
        RxJS.merge(
          RxJS.of(response).pipe(
            RxJS.filter(axiosResponse =>
              axiosResponse?.data?.success &&
              axiosResponse?.data?.data?.has_next_page &&
              axiosResponse?.data?.data?.end_cursor
            ),
            RxJS.delay(this._apiDelay),
            RxJS.mergeMap(axiosResponse =>
              this._httpService.get(`https://instagram188.p.rapidapi.com/userpost/${airdropSchedule.socialLively.userId}/${this._FETCH_COUNT}/${axiosResponse.data.data.end_cursor}`, {
                headers: {
                  'X-RapidAPI-Key': this._apiKey,
                  'X-RapidAPI-Host': this._apiHost
                }
              })
            ),
          ),
          RxJS.of(response).pipe(
            RxJS.filter(axiosResponse =>
              !axiosResponse?.data?.success ||
              !axiosResponse?.data?.data?.has_next_page ||
              !axiosResponse?.data?.data?.end_cursor
            ),
            RxJS.mergeMap(_ => RxJS.EMPTY)
          )
        ),
        1
      ),
      RxJS.map(response => [airdropSchedule.socialLively, response]),
      RxJS.tap({
        next: tuple => this._logger.debug(`fetch lively instagram posts success, count: ${tuple[1]?.data?.data?.edges?.length}`),
        error: err => this._logger.error(`fetch lively instagram posts failed`, err)
      })
    )
  }
}