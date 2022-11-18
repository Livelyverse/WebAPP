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


@Injectable()
export class InstagramPostTrackerJob {
  private readonly _logger = new Logger(InstagramPostTrackerJob.name);
  private readonly _apiKey: string;
  private readonly _apiHost: string;
  private readonly _commentFilter: string;
  private readonly _airdropFilter: string;
  private readonly _trackerDuration: number;
  private readonly _trackerInterval: number;
  private readonly _startAt: Date;

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

    this._trackerDuration = this._configService.get<number>('airdrop.instagram.tracker.duration');
    if (!this._trackerDuration) {
      throw new Error("airdrop.instagram.tracker.duration config is empty");
    }

    this._trackerInterval = this._configService.get<number>('airdrop.instagram.tracker.interval');
    if (!this._trackerInterval) {
      throw new Error("airdrop.instagram.tracker.interval config is empty");
    }

    const startTimestamp = this._configService.get<number>('airdrop.instagram.startAt');
    this._startAt = new Date(startTimestamp);

    const interval = setInterval(this.fetchPostFromPage.bind(this), this._trackerInterval);
    this._schedulerRegistry.addInterval('InstagramPostsTrackerJob', interval);
    this.fetchPostFromPage();
  }

  private fetchPostFromPage() {

    const socialLivelyQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'INSTAGRAM\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.debug(`fetch social lively success, socialType: ${socialLively.socialType}`)),
        RxJS.catchError(err => RxJS.throwError(() => new FollowerError('fetch INSTAGRAM social lively failed', err)))
      )

    RxJS.from(socialLivelyQueryResultObservable).pipe(
      RxJS.mergeMap(socialLively => this._getDataFromApi(socialLively))
    ).subscribe({
      // next: value => this._logger.log(`received value: ${JSON.stringify(value, null, 2)}`),
      error: err => this._logger.error(`error`, err),
      complete: () => this._logger.log(`complete . . .`)
    })
  }

  private _getDataFromApi(socialLively: SocialLivelyEntity): Observable<any> {
    return this._httpService.get(`https://instagram188.p.rapidapi.com/userpost/${socialLively.userId}/3/%7Bend_cursor%7D`, {
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
            RxJS.delay(4000),
            RxJS.mergeMap(axiosResponse =>
              this._httpService.get(`https://instagram188.p.rapidapi.com/userpost/${socialLively.userId}/3/${axiosResponse.data.data.end_cursor}`, {
                headers: {
                  'X-RapidAPI-Key': this._apiKey,
                  'X-RapidAPI-Host': this._apiHost
                }
              })
            )
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
      RxJS.tap({
        next: value => this._logger.log(`api data: ${JSON.stringify(value.data)}\n`),
        error: err => this._logger.log(`api error`, err)
      })
    )
  }
}