import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { InjectEntityManager } from "@nestjs/typeorm";
import { Brackets, EntityManager, MoreThan } from "typeorm";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { InstagramPostDto } from "../../dto/instagramPost.dto";
import { SocialEventEntity } from "../../entity/socialEvent.entity";
import { ContentDto } from "../../dto/content.dto";
import { SocialAirdropScheduleEntity } from "../../entity/socialAirdropSchedule.entity";
import { SocialProfileEntity, SocialType } from "../../../../profile/domain/entity/socialProfile.entity";
import { TrackerError } from "../../error/tracker.error";
import { SocialAirdropRuleEntity } from "../../entity/socialAirdropRule.entity";
import { SocialActionType } from "../../entity/enums";
import { AxiosError } from 'axios';
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialAirdropEntity } from "../../entity/socialAirdrop.entity";

type RegexHashtagFilter = {
  commentRegex: RegExp;
  airdropRegex: RegExp;
  joinRegex: RegExp;
}

type PostDataPipe = {
  postData: Object,
  socialEvent: SocialEventEntity,
  filterRegexes: RegexHashtagFilter,
  airdropLikeRule: SocialAirdropRuleEntity,
  airdropCommentRule: SocialAirdropRuleEntity,
  airdropSchedule: SocialAirdropScheduleEntity
}

@Injectable()
export class InstagramPostTrackerJob {
  private readonly _logger = new Logger(InstagramPostTrackerJob.name);
  private readonly _apiKey: string;
  private readonly _apiHost: string;
  private readonly _trackerInterval: number;
  private readonly _FETCH_COUNT = 50;
  private readonly _apiDelay: number;
  private _isRunning: boolean;
  private _isEnable: boolean;

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

    this._isRunning = false;
    this._trackerInterval = this._configService.get<number>('airdrop.instagram.tracker.postInterval');
    if (!this._trackerInterval) {
      throw new Error("airdrop.instagram.tracker.postInterval config is empty");
    }

    this._apiDelay = this._configService.get<number>('airdrop.instagram.apiDelay');

    this._isEnable = this._configService.get<boolean>("airdrop.instagram.enable");
    if (this._isEnable === null) {
      throw new Error("airdrop.instagram.enable config is empty");
    }

    if (this._isEnable) {
      const interval = setInterval(this.fetchInstagramPosts.bind(this), this._trackerInterval);
      this._schedulerRegistry.addInterval('InstagramPostsTrackerJob', interval);
      this.fetchInstagramPosts();
    }
  }

  private fetchInstagramPosts() {
    if (!this._isRunning) {
      this._isRunning = true;
    } else {
      this._logger.warn("fetchInstagramPost is already running . . .");
      return;
    }

    const airdropScheduleQueryResultObservable = RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
      .findOneOrFail({
        relations: {
          socialLively: true
        },
        loadEagerRelations: true,
        where: {
          socialLively: {
            socialType: SocialType.INSTAGRAM,
            isActive: true,
          },
          airdropEndAt: MoreThan(new Date())
        }
      })
    ).pipe(
      RxJS.tap({
        next: (airdropSchedule) => this._logger.debug(`fetch instagram airdrop schedule success, socialType: ${airdropSchedule.socialLively.socialType}`),
        error: (err) => this._logger.error(`find instagram airdrop schedule failed`, err)
      }),
      RxJS.map(airdropSchedule => {
        const filterRegexes: RegexHashtagFilter = {
          airdropRegex: new RegExp(airdropSchedule.hashtags.airdrop, 'g'),
          joinRegex: airdropSchedule.hashtags?.join ? new RegExp(airdropSchedule.hashtags.join, 'g') : null,
          commentRegex: airdropSchedule.hashtags?.comment ? new RegExp(airdropSchedule.hashtags.comment, 'g') : null,
        }
        return { airdropSchedule, filterRegexes }
      }),
      RxJS.catchError(err => RxJS.throwError(() => new TrackerError('fetch instagram airdrop schedule failed', err)))
    )

    this._logger.debug("Instagram Tracker job starting . . . ");

    RxJS.from(airdropScheduleQueryResultObservable).pipe(
      // fetch social lively airdrop instagram rules
      RxJS.mergeMap((airdropScheduleInfo) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
          .select()
          .where('"airdropRule"."socialType" = \'INSTAGRAM\'')
          .andWhere(new Brackets((qb) => {
            qb.where('"airdropRule"."actionType" = \'LIKE\'').
              orWhere('"airdropRule"."actionType" = \'COMMENT\'')
          }),
          )
          .getMany()
        ).pipe(
          RxJS.tap({
            next: (airdropRules) => airdropRules.forEach(airdropRule => this._logger.debug(`tweeter tracker airdrop rule found, actionType: ${airdropRule.actionType}, token: ${airdropRule.unit},  amount: ${airdropRule.amount}, decimal: ${airdropRule.decimal}`)),
            error: (err) => this._logger.error(`find instagram tracker airdrop rule failed`, err)
          }),
          RxJS.mergeMap((airdropRules) =>
            RxJS.merge(
              RxJS.of(airdropRules).pipe(
                RxJS.filter((airdropRules) => airdropRules.length == 2),
                RxJS.mergeMap((airdropRules) =>
                  RxJS.merge(
                    RxJS.of(airdropRules).pipe(
                      RxJS.filter((airdropRules) => airdropRules[0].actionType == SocialActionType.LIKE),
                      RxJS.map((airdropRules) => ({ airdropLikeRule: airdropRules[0], airdropCommentRule: airdropRules[1], ...airdropScheduleInfo }))
                    ),
                    RxJS.of(airdropRules).pipe(
                      RxJS.filter((airdropRules) => airdropRules[1].actionType == SocialActionType.LIKE),
                      RxJS.map((airdropRules) => ({ airdropLikeRule: airdropRules[1], airdropCommentRule: airdropRules[0], ...airdropScheduleInfo }))
                    )
                  )
                )
              ),
              RxJS.of(airdropRules).pipe(
                RxJS.filter((airdropRules) => airdropRules.length != 2),
                RxJS.mergeMap((_) => RxJS.throwError(() => new TrackerError("instagram tracker airdrop rules not found", null)))
              )
            )
          ),
          RxJS.tap({
            error: (err) => this._logger.error(`fetch instagram airdrop rules failed`, err)
          }),
          RxJS.catchError(err => RxJS.throwError(() => new TrackerError('fetch instagram airdrop rules failed', err)))
        )
      ),
      // fetch instagram events from db which airdropEndAt greater than now
      RxJS.switchMap((airdropInfo) =>
        RxJS.from(this._entityManager.getRepository(SocialEventEntity)
          .findOne({
            relations: {
              airdropSchedule: true
            },
            join: {
              alias: "socialEvent",
              innerJoinAndSelect: {
                airdropSchedule: "socialEvent.airdropSchedule",
                socialLively: "airdropSchedule.socialLively"
              }
            },
            where: {
              airdropSchedule: {
                airdropEndAt: MoreThan(new Date()),
                socialLively: {
                  socialType: SocialType.INSTAGRAM,
                }
              }
            },
            order: {
              ["publishedAt"]: "DESC"
            }
          })
        ).pipe(
          RxJS.switchMap((queryResult) =>
            RxJS.merge(
              //SocialEvent with active tracker not found
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => !queryResult),
                RxJS.tap((_) => this._logger.log(`pipe(1-0): SocialEvent with active schedule not found . . .`)),
                RxJS.switchMap(_ =>
                  // fetch instagram posts
                  RxJS.defer(() =>
                    RxJS.from(this._fetchLivelyPosts(airdropInfo.airdropSchedule)).pipe(
                      RxJS.map((postData: any) => ({ postData, ...airdropInfo }))
                    )
                  ).pipe(
                    RxJS.tap({
                      next: objInfo => this._logger.debug(`pipe(1-0): fetch instagram posts success, count: ${objInfo?.postData?.data?.edges?.length}`),
                    }),
                    RxJS.concatMap(objInfo =>
                      RxJS.from(objInfo.postData.data.edges).pipe(
                        RxJS.filter((edge: any) => (edge.node.taken_at_timestamp > airdropInfo.airdropSchedule.airdropStartAt.getTime() / 1000) &&
                          edge?.node?.edge_media_to_caption?.edges[0]?.node?.text?.match(objInfo.filterRegexes.airdropRegex)),
                        RxJS.mergeMap(edge =>
                          RxJS.merge(
                            RxJS.from(this._entityManager.getRepository(SocialEventEntity)
                              .findOne({
                                join: {
                                  alias: "socialEvent",
                                  innerJoin: {
                                    airdropSchedule: "socialEvent.airdropSchedule",
                                    socialLively: "airdropSchedule.socialLively"
                                  }
                                },
                                where: {
                                  airdropSchedule: {
                                    socialLively: {
                                      socialType: SocialType.INSTAGRAM
                                    }
                                  },
                                  contentId: edge.node.id
                                }
                              }))
                          ).pipe(
                            RxJS.tap({
                              error: err => this._logger.error(`pipe(1-0): find socialEvent failed, id: ${edge.node.id}`, err)
                            }),
                            RxJS.mergeMap(findEvent =>
                              RxJS.merge(
                                RxJS.of(findEvent).pipe(
                                  RxJS.filter(findEvent => !findEvent),
                                  RxJS.tap({
                                    next: _ => this._logger.debug(`pipe(1-0): instagram post not found in db, ContentId: ${edge.node.id}`),
                                  }),
                                  RxJS.map(_ => {
                                    const postDto = InstagramPostDto.from(edge);
                                    const socialEvent = new SocialEventEntity();
                                    socialEvent.contentId = postDto.id;
                                    socialEvent.content = ContentDto.from(postDto);
                                    socialEvent.lang = null;
                                    socialEvent.publishedAt = postDto?.createdAt ? new Date(postDto.createdAt * 1000) : new Date();
                                    socialEvent.contentUrl = 'https://www.instagram.com/p/' + postDto.shortcode;
                                    socialEvent.airdropSchedule = objInfo.airdropSchedule;
                                    return socialEvent;
                                  }),
                                  RxJS.concatMap((socialEvent) =>
                                    RxJS.from(this._entityManager.createQueryBuilder()
                                      .insert()
                                      .into(SocialEventEntity)
                                      .values([socialEvent])
                                      .execute()
                                    ).pipe(
                                      RxJS.tap({
                                        next: (_) => this._logger.log(`pipe(1-0), save instagram SocialEvent success, post.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`),
                                        error: err => this._logger.error(`pipe(1-0), save instagram SocialEvent failed, post.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`, err),
                                      }),
                                      RxJS.map((_) => ({ socialEvent, ...objInfo })),
                                      RxJS.catchError(error => RxJS.throwError(() => new TrackerError('save instagram SocialEvent failed', error)))
                                    )
                                  )
                                ),
                                RxJS.of(findEvent).pipe(
                                  RxJS.filter(findEvent => !!findEvent),
                                  RxJS.tap({
                                    next: entity => this._logger.debug(`pipe(1-0): instagram post already exists in db, id: ${entity.id}, ContentId: ${entity.contentId}`),
                                  }),
                                  RxJS.mergeMap(_ => RxJS.NEVER),
                                )
                              )
                            )
                          )
                        )
                      )
                    ),
                    RxJS.retry({
                      count: 3,
                      delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                        RxJS.mergeMap(([error, retryCount]) =>
                          RxJS.merge(
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err, count]) => err instanceof AxiosError &&
                                (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                                count <= 3
                              ),
                              RxJS.tap({
                                error: err => this._logger.warn(`pipe(1-0): httpClient get instagram post failed, message: ${err.message}, code: ${err.code}`)
                              }),
                              RxJS.delay(60000)
                            ),
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err, count]) => err instanceof AxiosError &&
                                (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                                count > 3
                              ),
                              RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('fetch instagram posts failed', err))),
                            ),
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err, _]) => err instanceof Error),
                              RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('fetch instagram posts failed', err))),
                            ),
                          )
                        ),
                        RxJS.tap(([_, retryCount]) => this._logger.warn(`get lively instagram post failed, retry ${retryCount} . . . `))
                      )
                    }),
                    RxJS.tap({
                      error: (error) => this._logger.error(`pipe(1-0): fetch instagram posts failed`, error)
                    }),
                    RxJS.catchError((error) =>
                      RxJS.merge(
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof TrackerError || err instanceof AxiosError),
                          RxJS.mergeMap(err => RxJS.throwError(err))
                        ),
                        RxJS.of(error).pipe(
                          RxJS.filter(err => !(err instanceof TrackerError && err instanceof AxiosError)),
                          RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('fetch instagram posts failed', err)))
                        )
                      )
                    ),
                    RxJS.finalize(() => this._logger.debug(`pipe(1-0), finalize instagram get posts . . .`)),
                  )
                ),
              ),
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => !!queryResult),
                RxJS.tap((_) => this._logger.log(`pipe(2-0): SocialEvent with active schedule found . . .`)),
                RxJS.map(socialEvent => ({ socialEvent, postData: null, ...airdropInfo }))
              )
            )
          )
        )
      ),
      // fetch likes and comments from contents
      RxJS.concatMap((objInfo: PostDataPipe) =>
        RxJS.concat(
          // fetch post likes
          RxJS.defer(() =>
            RxJS.from(this._fetchPostLikes((<InstagramPostDto>objInfo.socialEvent.content.data).shortcode).pipe(
              RxJS.map(postLikes => ({ postLikes, ...objInfo }))
            ))
          ).pipe(
            RxJS.tap({
              next: (data) => this._logger.debug(`pipe(3-0): instagram httpClient post Likes count: ${data.postLikes?.has_next_page?.data?.length}`),
            }),
            RxJS.mergeMap(data =>
              RxJS.merge(
                RxJS.of(data).pipe(
                  RxJS.filter(data => !!data?.postLikes?.has_next_page?.data && data?.postLikes?.has_next_page?.data?.length > 0),
                  RxJS.concatMap((data: any) =>
                    RxJS.from(data.postLikes.has_next_page.data).pipe(
                      RxJS.concatMap((nodeIndo: any) =>
                        RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                          .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                          .addSelect('"sub"."tid" as "trackerId"')
                          .addSelect('"sub"."eid" as "eventId"')
                          .addSelect('"users"."email"')
                          .innerJoin("user", "users", '"users"."id" = "socialProfile"."userId"')
                          .leftJoin(qb =>
                            qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                              .from(SocialProfileEntity, "profile")
                              .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                              .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                              .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "event"."airdropScheduleId"')
                              .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
                              .where('"event"."contentId" = :contentId', { contentId: data.socialEvent.contentId })
                              .andWhere('"tracker"."actionType" = \'LIKE\'')
                              .andWhere('"profile"."username" = :username', { username: nodeIndo.node.username })
                              .andWhere('"profile"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType })
                              .andWhere('"socialLively"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType }),
                            "sub", '"sub"."pid" = "socialProfile"."id"')
                          .where('"socialProfile"."username" = :username', { username: nodeIndo.node.username })
                          .andWhere('"socialProfile"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType })
                          .getRawOne()
                        ).pipe(
                          RxJS.tap({
                            error: (error) => this._logger.error(`pipe(3-0): find socialProfile and socialTracker failed, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}`, error),
                          }),
                          RxJS.mergeMap((queryResult) =>
                            RxJS.merge(
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !queryResult),
                                RxJS.tap({
                                  next: (_) => this._logger.debug(`pipe(3-0): socialProfile and socialTracker not found, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}, username: ${nodeIndo.node.username}`),
                                }),
                                RxJS.mergeMap((_) => RxJS.EMPTY)
                              ),
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !!queryResult && queryResult.trackerId && queryResult.eventId),
                                RxJS.tap({
                                  next: (queryResult) => this._logger.debug(`pipe(3-0): socialTracker already exists, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}, socialTracker.id: ${queryResult.trackerId}, socialProfile.username: ${queryResult.profileUsername}`),
                                }),
                                RxJS.mergeMap((_) => RxJS.EMPTY)
                              ),
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !!queryResult && !queryResult.eventId && queryResult.profileId),
                                RxJS.tap({
                                  next: (queryResult) => this._logger.debug(`pipe(3-0): socialProfile found, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}, socialProfile.username: ${queryResult.profileUsername}`),
                                }),
                              )
                            )
                          ),
                          RxJS.map((queryResult) => {
                            const socialProfile = new SocialProfileEntity();
                            socialProfile.id = queryResult.profileId;
                            socialProfile.username = queryResult.profileUsername;

                            const socialTracker = new SocialTrackerEntity();
                            socialTracker.actionType = SocialActionType.LIKE;
                            socialTracker.socialEvent = data.socialEvent;
                            socialTracker.socialProfile = socialProfile;

                            const socialLikeAirdrop = new SocialAirdropEntity();
                            socialLikeAirdrop.airdropRule = data.airdropLikeRule;
                            socialLikeAirdrop.socialTracker = socialTracker;

                            return { socialTracker, socialLikeAirdrop, ...data };
                          }),
                          RxJS.concatMap((pipeResult) =>
                            RxJS.from(
                              this._entityManager.connection.transaction(async (manager) => {
                                await manager.createQueryBuilder()
                                  .insert()
                                  .into(SocialTrackerEntity)
                                  .values([pipeResult.socialTracker])
                                  .execute()

                                await manager.createQueryBuilder()
                                  .insert()
                                  .into(SocialAirdropEntity)
                                  .values([pipeResult.socialLikeAirdrop])
                                  .execute();
                              })
                            ).pipe(RxJS.tap({
                              next: (_) => this._logger.log(`pipe(3-0): save socialTracker success, trackerId: ${pipeResult.socialTracker.id}, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`),
                              error: (error) => this._logger.error(`pipe(3-0): save socialTracker failed, tweet.Id: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`, error),
                            }),
                            )
                          ),
                          RxJS.tap({
                            error: err => this._logger.error(`pipe(3-0): fetch and persist instagram Likes failed`, err)
                          }),
                          RxJS.catchError(error => RxJS.throwError(() => new TrackerError('fetch and persist instagram Likes failed', error)))
                        )
                      )
                    )
                  ),
                ),
                RxJS.of(data).pipe(
                  RxJS.filter(data => !data?.postLikes?.has_next_page?.data || !data?.postLikes?.has_next_page?.data?.length),
                  RxJS.tap({
                    next: _ => this._logger.log(`pipe(3-0): instagram post likes not found, postId: ${data.socialEvent.contentId}`)
                  })
                )
              )
            ),
            RxJS.retry({
              count: 3,
              delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                RxJS.mergeMap(([error, retryCount]) =>
                  RxJS.merge(
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, count]) => err instanceof AxiosError &&
                        (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                        count <= 3
                      ),
                      RxJS.tap({
                        error: err => this._logger.warn(`pipe(3-0): httpClient get instagram post likes failed, message: ${err.message}, code: ${err.code}`)
                      }),
                      RxJS.delay(60000)
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, count]) => err instanceof AxiosError &&
                        (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                        count > 3
                      ),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('instagram fetch post like failed', err))),
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, _]) => err instanceof Error),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('instagram fetch post like failed', err))),
                    ),
                  )
                ),
                RxJS.tap(([_, retryCount]) => this._logger.warn(`get lively instagram post likes failed, retry ${retryCount} . . . `))
              )
            }),
            RxJS.tap({
              error: (error) => this._logger.error(`pipe(3-0): fetch instagram post like failed, postId: ${objInfo.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}`, error)
            }),
            RxJS.catchError((error) =>
              RxJS.merge(
                RxJS.of(error).pipe(
                  RxJS.filter(err => err instanceof TrackerError || err instanceof AxiosError),
                  RxJS.mergeMap(err => RxJS.throwError(err))
                ),
                RxJS.of(error).pipe(
                  RxJS.filter(err => !(err instanceof TrackerError && err instanceof AxiosError)),
                  RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('instagram fetch post likes failed', err)))
                )
              )
            ),
            RxJS.finalize(() => this._logger.debug(`pipe(3-0): finalize instagram client post likes, postId: ${objInfo.socialEvent.contentId}`)),
          ),
          // fetch instagram post comments
          RxJS.defer(() =>
            RxJS.from(this._fetchPostComments((<InstagramPostDto>objInfo.socialEvent.content.data).shortcode).pipe(
              RxJS.map(postComments => ({ postComments, ...objInfo }))
            ))
          ).pipe(
            RxJS.tap({
              next: (data) => this._logger.debug(`pipe(4-0): instagram httpClient post comments count: ${data?.postComments?.data?.comments?.length}`),
            }),
            RxJS.mergeMap(data =>
              RxJS.merge(
                RxJS.of(data).pipe(
                  RxJS.filter(data => !!data?.postComments?.data?.comments?.length && data.postComments.data.comments.length > 0),
                  RxJS.concatMap((data) =>
                    RxJS.from(data.postComments.data.comments).pipe(
                      RxJS.filter((comment: any) => comment.text.match(objInfo.filterRegexes.commentRegex)),
                      RxJS.concatMap((comment: any) =>
                        RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                          .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                          .addSelect('"sub"."tid" as "trackerId"')
                          .addSelect('"sub"."eid" as "eventId"')
                          .addSelect('"users"."email"')
                          .innerJoin("user", "users", '"users"."id" = "socialProfile"."userId"')
                          .leftJoin(qb =>
                            qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                              .from(SocialProfileEntity, "profile")
                              .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                              .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                              .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "event"."airdropScheduleId"')
                              .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
                              .where('"event"."contentId" = :contentId', { contentId: data.socialEvent.contentId })
                              .andWhere('"tracker"."actionType" = \'COMMENT\'')
                              .andWhere('"profile"."username" = :username', { username: comment.user.username })
                              .andWhere('"profile"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType })
                              .andWhere('"socialLively"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType }),
                            "sub", '"sub"."pid" = "socialProfile"."id"')
                          .where('"socialProfile"."username" = :username', { username: comment.user.username })
                          .andWhere('"socialProfile"."socialType" = :socialType', { socialType: data.airdropSchedule.socialLively.socialType })
                          .getRawOne()
                        ).pipe(
                          RxJS.tap({
                            error: (error) => this._logger.error(`pipe(4-0): find socialProfile and socialTracker failed, tweet.Id: ${data.socialEvent.contentId}`, error),
                          }),
                          RxJS.mergeMap((queryResult) =>
                            RxJS.merge(
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !queryResult),
                                RxJS.tap({
                                  next: (_) => this._logger.log(`pipe(4-0): socialProfile and socialTracker not found, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>data.socialEvent.content.data).shortcode}, username: ${data.postComments.user.username}`),
                                }),
                                RxJS.mergeMap((_) => RxJS.EMPTY)
                              ),
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !!queryResult && queryResult.trackerId && queryResult.eventId),
                                RxJS.tap({
                                  next: (queryResult) => this._logger.log(`pipe(4-0): socialTracker already exists, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>data.socialEvent.content.data).shortcode}, socialTracker.id: ${queryResult.trackerId}, socialProfile.username: ${queryResult.profileUsername}`),
                                }),
                                RxJS.mergeMap((_) => RxJS.EMPTY)
                              ),
                              RxJS.of(queryResult).pipe(
                                RxJS.filter((queryResult) => !!queryResult && !queryResult.eventId && queryResult.profileId),
                                RxJS.tap({
                                  next: (queryResult) => this._logger.log(`pipe(4-0): socialProfile found, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>data.socialEvent.content.data).shortcode}, socialProfile.username: ${queryResult.profileUsername}`),
                                }),
                              )
                            )
                          ),
                          RxJS.map((queryResult) => {
                            const socialProfile = new SocialProfileEntity();
                            socialProfile.id = queryResult.profileId;
                            socialProfile.username = queryResult.profileUsername;
                            const socialTracker = new SocialTrackerEntity();
                            socialTracker.actionType = SocialActionType.COMMENT;
                            socialTracker.socialEvent = data.socialEvent;
                            socialTracker.socialProfile = socialProfile;

                            const socialCommentAirdrop = new SocialAirdropEntity();
                            socialCommentAirdrop.airdropRule = data.airdropCommentRule;
                            socialCommentAirdrop.socialTracker = socialTracker;

                            return { socialTracker, socialCommentAirdrop: socialCommentAirdrop, ...data };
                          }),
                          RxJS.concatMap((pipeResult) =>
                            RxJS.from(
                              this._entityManager.connection.transaction(async (manager) => {
                                await manager.createQueryBuilder()
                                  .insert()
                                  .into(SocialTrackerEntity)
                                  .values([pipeResult.socialTracker])
                                  .execute()

                                await manager.createQueryBuilder()
                                  .insert()
                                  .into(SocialAirdropEntity)
                                  .values([pipeResult.socialCommentAirdrop])
                                  .execute();
                              })
                            ).pipe(
                              RxJS.tap({
                                next: (_) => this._logger.log(`pipe(4-0): save socialTracker success, postId: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>data.socialEvent.content.data).shortcode},  action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`),
                                error: (error) => this._logger.error(`pipe(4-0): save socialTracker failed, tweet.Id: ${data.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>data.socialEvent.content.data).shortcode}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`, error),
                              }),
                            )
                          ),
                          RxJS.tap({
                            error: (error) => this._logger.error(`pipe(4-0): fetch and persist instagram post comments failed`, error),
                          }),
                          RxJS.catchError(error => RxJS.throwError(() => new TrackerError('fetch and persist instagram post comments failed', error)))
                        )
                      )
                    )
                  ),
                ),
                RxJS.of(data).pipe(
                  RxJS.filter(data => !data?.postComments?.data?.comments?.length || !data?.postComments?.data?.comments?.length),
                  RxJS.tap({
                    next: _ => this._logger.log(`pipe(4-0): instagram post comments not found, postId: ${data.socialEvent.contentId}`)
                  })
                )
              )
            ),
            RxJS.retry({
              count: 3,
              delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                RxJS.mergeMap(([error, retryCount]) =>
                  RxJS.merge(
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, count]) => err instanceof AxiosError &&
                        (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                        count <= 3
                      ),
                      RxJS.tap({
                        error: err => this._logger.warn(`pipe(4-0): httpClient get instagram post comments failed, message: ${err.message}, code: ${err.code}`)
                      }),
                      RxJS.delay(60000)
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, count]) => err instanceof AxiosError &&
                        (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT) &&
                        count > 3
                      ),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('fetch instagram post comments failed', err))),
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err, _]) => err instanceof Error),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new TrackerError('fetch instagram post comments failed', err))),
                    ),
                  )
                ),
                RxJS.tap(([_, retryCount]) => this._logger.warn(`get lively instagram post likes failed, retry ${retryCount} . . . `))
              )
            }),
            RxJS.tap({
              error: (error) => this._logger.error(`pipe(4-0): fetch instagram posts comments failed, postId: ${objInfo.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}`, error)
            }),
            RxJS.catchError((error) =>
              RxJS.merge(
                RxJS.of(error).pipe(
                  RxJS.filter(err => err instanceof TrackerError || err instanceof AxiosError),
                  RxJS.mergeMap(err => RxJS.throwError(err))
                ),
                RxJS.of(error).pipe(
                  RxJS.filter(err => !(err instanceof TrackerError && err instanceof AxiosError)),
                  RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('instagram fetch post comments failed', err)))
                )
              )
            ),
            RxJS.finalize(() => this._logger.debug(`pipe(4-0): finalize instagram client post comments, postId: ${objInfo.socialEvent.contentId}, shortcode: ${(<InstagramPostDto>objInfo.socialEvent.content.data).shortcode}`)),
          )
        )
      )
    ).subscribe({
      error: err => {
        this._logger.error(`fetch Instagram Posts failed\n err: ${err?.cause?.stack ? err.cause.stack : err?.stack}`, err);
        this._isRunning = false;
      },
      complete: () => {
        this._logger.log(`fetch Instagram Posts complete . . .`);
        this._isRunning = false;
      }
    })
  }

  private _fetchLivelyPosts(airdropSchedule: SocialAirdropScheduleEntity): RxJS.Observable<any> {
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
            RxJS.tap({
              next: response => this._logger.debug('_fetchLivelyPosts call api complete,' +
                `data.success: ${response?.data?.success}, hasNextPage: ${response?.data?.data?.has_next_page} `)
            }),
            RxJS.mergeMap(_ => RxJS.EMPTY)
          )
        ),
        1
      ),
      RxJS.map(response => response.data),
    )
  }

  private _fetchPostLikes(shortcode: string): RxJS.Observable<any> {
    return this._httpService.get(`https://instagram188.p.rapidapi.com/postlike/${shortcode}/${this._FETCH_COUNT}/%7Bend_cursor%7D`, {
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
              this._httpService.get(`https://instagram188.p.rapidapi.com/postlike/${shortcode}/${this._FETCH_COUNT}/${axiosResponse.data.data.end_cursor}`, {
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
            RxJS.tap({
              next: response => this._logger.debug('_fetchPostLikes call api complete,' +
                `data.success: ${response?.data?.success}, hasNextPage: ${response?.data?.data?.has_next_page} `)
            }),
            RxJS.mergeMap(_ => RxJS.EMPTY)
          )
        ),
        1
      ),
      RxJS.map(response => response.data),
    )
  }

  private _fetchPostComments(shortcode: string): RxJS.Observable<any> {
    return this._httpService.get(`https://instagram188.p.rapidapi.com/postcomment/${shortcode}/%7Bend_cursor%7D`, {
      headers: {
        'X-RapidAPI-Key': this._apiKey,
        'X-RapidAPI-Host': this._apiHost
      }
    }).pipe(
      RxJS.expand(response =>
        RxJS.merge(
          RxJS.of(response).pipe(
            RxJS.filter(axiosResponse =>
              axiosResponse?.data?.status &&
              axiosResponse?.data?.data?.has_more_headload_comments &&
              axiosResponse?.data?.data?.end_cursor
            ),
            RxJS.delay(this._apiDelay),
            RxJS.mergeMap(axiosResponse =>
              this._httpService.get(`https://instagram188.p.rapidapi.com/postcomment/${shortcode}/${axiosResponse.data.data.end_cursor}`, {
                headers: {
                  'X-RapidAPI-Key': this._apiKey,
                  'X-RapidAPI-Host': this._apiHost
                }
              })
            ),
          ),
          RxJS.of(response).pipe(
            RxJS.filter(axiosResponse =>
              !axiosResponse?.data?.status ||
              !axiosResponse?.data?.data?.has_more_headload_comments ||
              !axiosResponse?.data?.data?.end_cursor
            ),
            RxJS.tap({
              next: response => this._logger.debug('_fetchPostComments call api complete,' +
                `data.success: ${response?.data?.success}, headLoadComments: ${response?.data?.data?.has_more_headload_comments} `)
            }),
            RxJS.mergeMap(_ => RxJS.EMPTY)
          )
        ),
        1
      ),
      RxJS.map(response => response.data),
    )
  }
}