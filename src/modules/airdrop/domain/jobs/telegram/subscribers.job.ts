import { Injectable, Logger } from '@nestjs/common';
import { Telegram, Telegraf, Scenes, session, Context, NarrowedContext } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, EntityNotFoundError, MoreThan } from 'typeorm';
import { SocialProfileEntity, SocialType } from '../../../../profile/domain/entity/socialProfile.entity'
import { SocialEventEntity } from '../../entity/socialEvent.entity';
import { SocialActionType } from '../../entity/enums';
import { SocialAirdropScheduleEntity } from '../../entity/socialAirdropSchedule.entity';
import { SocialTrackerEntity } from '../../entity/socialTracker.entity';
import { SocialAirdropEntity } from '../../entity/socialAirdrop.entity';
import { SocialAirdropRuleEntity } from '../../entity/socialAirdropRule.entity';
import { ContentDto } from '../../dto/content.dto';

class SendTelegramMessage {
  message_id: number
}

@Injectable()
export class TelegramSubscriberJob {
  private readonly _logger = new Logger(TelegramSubscriberJob.name);
  private readonly _token;
  private readonly _channelName: string;
  private readonly _bot: Telegraf;
  private readonly _telegram: Telegram;
  private readonly _owner;
  private readonly _admins;
  private readonly _numTrackerInterval;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    private readonly _configService: ConfigService,
  ) {
    this._token = this._configService.get<string>("airdrop.telegram.token");
    if (!this._token) {
      throw new Error("airdrop.telegram.token config is empty");
    }

    this._channelName = this._configService.get<string>("airdrop.telegram.channelName");
    if (!this._channelName) {
      throw new Error("airdrop.telegram.channelName config is empty");
    }

    this._owner = this._configService.get<string>("airdrop.telegram.owner");
    if (!this._owner) {
      throw new Error("airdrop.telegram.owner config is empty");
    }

    this._admins = this._configService.get<number[]>("airdrop.telegram.admins");
    if (!this._admins) {
      throw new Error("airdrop.telegram.admins config is empty");
    }

    this._numTrackerInterval = this._configService.get<number>('airdrop.telegram.tracker.interval');
    if (!this._numTrackerInterval) {
      throw new Error("airdrop.telegram.tracker.interval config is empty");
    }

    // creating bot with the token
    this._bot = new Telegraf(this._token)
    // initializing telegram sdk with the the token
    this._telegram = new Telegram(this._token)
    this._initializeBot();
  }

  // this function should register all the middleware and actions to react to the users activity
  private async _initializeBot() {
    this._logger.debug("findNewSubscribers started!!!")
    try {
      // create stage from all scenes
      const stage = new Scenes.Stage<Scenes.SceneContext>([this._createAirdropScene()]);

      // session middleware will create a session for each user
      this._bot.use(session());

      // register stage middleware
      this._bot.use(stage.middleware());

      // on call bot for first time
      this._bot.start(async (ctx) => {
        // this._logger.debug('Started By', JSON.stringify(ctx));
        try {
          let keyboard
          if (this._admins.includes(ctx.update.message.from.id)) {
            keyboard = [
              [{ text: 'new airdrop event post 🤑' }],
              [{ text: 'Get your subscribe airdrop 💵' }],
            ]
          } else {
            keyboard = [[{ text: 'Get your subscribe airdrop 💵' }]]
          }
          await ctx.sendMessage('welcome', {
            reply_markup: {
              keyboard: keyboard,
              resize_keyboard: true,
            },
          });
        } catch (error) {
          this._logger.error("We can't send the telegram welcome message: ", error)
        }
      });

      // creating new airdrop post
      this._bot.hears('new airdrop event post 🤑', (ctx) => {
        if (!this._admins.includes(ctx.update.message.from.id)) return;
        try {
          (ctx as any).scene.enter('createAirdrop', { user_id: ctx.update.message.from.id });
        } catch (error) {
          this._logger.error("We can't enter to the scene in telegram job: ", error)
        }
      });

      // Getting subscribe airdrop
      this._bot.hears('Get your subscribe airdrop 💵', async (ctx) => {
        try {
          await this._fetchTelegramSubscribers(ctx)
        } catch (error) {
          this._logger.error("We can't enter to the scene in telegram job: ", error)
        }
      });

      // listening to the airdrop post click
      this._registerOnAirdropPostClicked()

      try {
        await this._bot.launch();
      } catch (error) {
        this._logger.error("We can't launch the telegram bot: ", error)
      }
    } catch (error) {
      this._logger.error('error on telegram: ', error);
    }
  }

  private _createAirdropScene() {
    return new Scenes.WizardScene<any>(
      'createAirdrop',
      async (ctx) => {
        if (! await this._sendReply(ctx, "TEXT", "failure of entering event post in telegram", "Type the event's tile: ")) return ctx.scene.leave();
        return ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.title = ctx.update.message.text;
        if (! await this._sendReply(ctx, "TEXT", "failure of getting image of event post in telegram", "Provide an image or send 'none': ")) return ctx.scene.leave();
        return ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.image = ctx.update.message.photo ? ctx.update.message.photo[1] : ctx.update.message.text;
        if (! await this._sendReply(ctx, "TEXT", "failure of getting button of event post in telegram: ", "Provide an action button text: ")) return ctx.scene.leave();
        return ctx.wizard.next();
      },
      async (ctx) => {
        try {
          ctx.scene.state.button = ctx.update.message.text;
          const state = ctx.scene.state;
          let schedule: SocialAirdropScheduleEntity
          try {
            schedule = await this._entityManager.getRepository(SocialAirdropScheduleEntity)
              .findOneOrFail({
                relations: {
                  socialLively: true
                },
                loadEagerRelations: true,
                where: {
                  socialLively: {
                    socialType: SocialType.TELEGRAM,
                    isActive: true,
                  },
                  airdropEndAt: MoreThan(new Date())
                }
              })
          } catch (error) {
            if (error instanceof EntityNotFoundError) {
              if (! await this._sendReply(ctx, "TEXT", "failure of getting schedule in telegram", "We are not in any active schedule right now. Make a schedule first.")) return ctx.scene.leave();
            } else {
              this._logger.error("We can't get schedule from the database: ", error)
              if (! await this._sendReply(ctx, "TEXT", "failure of getting schedule in telegram", `We can't send reply of entering event post in telegram: ${error}`)) return ctx.scene.leave();
            }
            return ctx.scene.leave();
          }

          let activeEvent: SocialEventEntity
          try {
            activeEvent = await this._entityManager.getRepository(SocialEventEntity).findOne({
              where: {
                isActive: true
              }
            })
          } catch(error) {
            this._logger.error("We can't get active event from the database: ", error)
            if (! await this._sendReply(ctx, "TEXT", "failure of getting active event from the database", `We can't get active event from the database: ${error}`)) return ctx.scene.leave();
            return ctx.scene.leave();
          }

          if (activeEvent) {
            if (! await this._sendReply(ctx, "TEXT", "failure of one active event is exists", `We can't have more than 1 event, Current event's id: ${activeEvent.id}`)) return ctx.scene.leave();
            return ctx.scene.leave();
          }

          let post: SendTelegramMessage
          try {
            post = await this._createAirdropPost(state.image.file_id ? state.image.file_id : state.image, state.title, state.button);
          } catch (error) {
            this._logger.error("We can't create an event post in telegram: ", error)
            if (! await this._sendReply(ctx, "TEXT", "failure of creating an event post in telegram channel", `We can't send created an event post in telegram channel: ${error}`)) return ctx.scene.leave();
            return ctx.scene.leave();
          }

          try {
            const content = ContentDto.fromMedia(ctx.scene.state.image)
            await this._entityManager.getRepository(SocialEventEntity).insert({
              publishedAt: new Date(),
              contentId: `${post.message_id}`,
              content: content,
              airdropSchedule: schedule,
            })
          } catch (error) {
            this._logger.error("We can't insert an event in database: ", error)
            if (! await this._sendReply(ctx, "TEXT", "failure of inserting an event in database", `We can't insert an event in database: ${error}`)) return ctx.scene.leave();
            return ctx.scene.leave();
          }

          if (! await this._sendReply(ctx, "TEXT", "result of created post", `The event posted successfully: t.me/${this._channelName.slice(1)}/${post.message_id}`)) return ctx.scene.leave();
        } catch (error) {
          this._logger.error("Unexpected error in telegram job scene: ", error)
        }
        return ctx.scene.leave();
      }
    );
  }

  // creating air drop post with image, caption and button
  private async _createAirdropPost(source: string, caption: string, btnText: string): Promise<SendTelegramMessage> {
    let result: SendTelegramMessage
    try {
      source === "none" ?
        result = await this._telegram.sendMessage(this._channelName, caption, {
          reply_markup: {
            inline_keyboard: [[{ text: btnText, callback_data: 'airdrop_clicked' }]],
          },
        })
        :
        result = await this._telegram.sendPhoto(this._channelName, source, {
          caption,
          reply_markup: {
            inline_keyboard: [[{ text: btnText, callback_data: 'airdrop_clicked' }]],
          },
        })
      return result;
    } catch (error) {
      this._logger.log('error on create air drop post: ', error);
      return error;
    }
  }

  /**
   * react to the airdrop post clicked
   * you can retrieve the user data from ctx.callbackQuery.from
   * every time user clicked the button it will trigger this action
   */

  private _registerOnAirdropPostClicked() {
    this._bot.action('airdrop_clicked', async (ctx: Context) => {
      try {
        let memberStatus: 'member' | 'left' | 'not' | 'creator'
        try {
          memberStatus = await this._memberInChannelStatus(ctx.callbackQuery.from.id);
        } catch (error) {
          this._logger.error("We can't get the status of the member: ", error)
          return
        }
        if (memberStatus === "left" || memberStatus === "not") {
          if (! await this._sendReply(ctx, "QUERY", "failure of member status in telegram", "Failed: You should join the channel first!")) return;
          return
        }
        const sender = { id: ctx.callbackQuery.from.id, username: ctx.callbackQuery.from.username, status: memberStatus }

        let event: SocialEventEntity
        try {
          event = await this._entityManager.getRepository(SocialEventEntity)
            .findOneOrFail({
              relations: {
                airdropSchedule: true
              },
              loadEagerRelations: true,
              where: {
                contentId: `${ctx.callbackQuery.message.message_id}`
              }
            })
        } catch (error) {
          this._logger.error("We can't get the event from the database:", error)
          if (! await this._sendReply(ctx, "QUERY", "failure of getting the event", "Failed: Can't find the event!")) return;
          return
        }
        if (event.airdropSchedule.airdropEndAt <= new Date()) {
          if (! await this._sendReply(ctx, "QUERY", "the reply of expired schedule", "Failed: The schedule of this event had been expired!")) return;
          return;
        }
        this._logger.debug("Event clicked:", JSON.stringify(event))
        this._logger.debug('air drop clicked by', sender.id, sender.username);

        let socialProfile: SocialProfileEntity
        try {
          socialProfile = await this._entityManager
            .getRepository(SocialProfileEntity).findOneOrFail({
              where: {
                socialType: SocialType.TELEGRAM,
                socialId: `${sender.id}`,
              }
            })
        } catch (error) {
          if (error instanceof EntityNotFoundError) {
            if (! await this._sendReply(ctx, "QUERY", "failure of getting social profile", "Failed: You should register at our platform first!")) return;
          } else {
            this._logger.error("We can't get the social profile from the database:", error)
            if (! await this._sendReply(ctx, "QUERY", "failure of getting social profile", "Failed: Sorry we can't get the social profile from the database")) return;
          }
          return;
        }

        let socialTracker: SocialTrackerEntity
        try {
          socialTracker = await this._entityManager.getRepository(SocialTrackerEntity)
            .findOne({
              relations: {
                socialEvent: true,
                socialProfile: true,
              },
              loadEagerRelations: true,
              where: {
                socialEvent: {
                  id: event.id
                },
                socialProfile: {
                  id: socialProfile.id
                },
              }
            })
        } catch (error) {
          if (error! instanceof EntityNotFoundError) {
            this._logger.error("We can't get telegram social tracker status: ", error)
            if (! await this._sendReply(ctx, "QUERY", "failure of getting telegram social tracker status", "Failed: Sorry we have some problems of getting social tracker status")) return;
            return;
          }
        }
        if (socialTracker) {
          if (! await this._sendReply(ctx, "QUERY", "social tracker was submitted before", "Success: You'r action submitted before!")) return;
          return;
        }

        let likeRule: SocialAirdropRuleEntity
        try {
          likeRule = await this._entityManager.getRepository(SocialAirdropRuleEntity).findOneOrFail({
            where: {
              socialType: SocialType.TELEGRAM,
              actionType: SocialActionType.LIKE,
            }
          })
        } catch (error) {
          this._logger.error("We can't get telegram like rule: ", error)
          if (! await this._sendReply(ctx, "QUERY", "failure of getting telegram like rule", "Failed: Sorry we have some problems of getting telegram like rule")) return;
          return;
        }

        try {
          await this._entityManager.transaction(async (manager) => {
            try {
              socialTracker = await manager.getRepository(SocialTrackerEntity).save({
                actionType: SocialActionType.LIKE,
                socialEvent: event,
                socialProfile: socialProfile
              })
            } catch (error) {
              this._logger.error("We can't insert new telegram social tracker: ", error)
              if (! await this._sendReply(ctx, "QUERY", "failure of submitting telegram social tracker status", "Failed: We can't submit your action in our database!")) return;
              return
            }

            try {
              await manager.getRepository(SocialAirdropEntity).save({
                airdropRule: likeRule,
                socialTracker: socialTracker,
              })
            } catch (error) {
              this._logger.error("We can't insert new telegram airdrop: ", error)
              if (! await this._sendReply(ctx, "QUERY", "failure of submitting telegram airdrop", "Failed: Sorry we can't insert the airdrop into the database")) return;
              return
            }
          })
        } catch (error) {
          this._logger.error("Saving telegram social tracker with transaction failed: ", error)
          if (! await this._sendReply(ctx, "QUERY", "failure of submitting telegram social tracker with transaction", "Failed: Sorry we can't insert the social tracker into the database")) return;
          return
        }

        if (! await this._sendReply(ctx, "QUERY", "reply of submitted action", "Success: You'r action submitted successfully!")) return;
        return
      } catch (error) {
        this._logger.error("Unexpected error on telegram action clicked: ", error)
      }
      return
    })
  }

  /**
   * @param id, check if member is in channel by his user id
   * also username is supported, just pass the user name as id
   */
  private async _memberInChannelStatus(id: number): Promise<'member' | 'left' | 'not' | 'creator'> {
    try {
      const result = await this._telegram.getChatMember(this._channelName, id);
      if (result.status === 'left') return 'left';
      else if (result.status === 'member') return 'member';
      else if (result.status === 'creator') return 'creator';
      else return 'not';
    } catch (error) {
      this._logger.error("We can't get chatMember status from the telegram: ", error)
      return error;
    }
  }
  private async _sendReply(ctx: Context, replyType: "TEXT" | "QUERY", subject: string, answer: string): Promise<boolean> {
    try {
      if (replyType === "TEXT") {
        try {
          await ctx.reply(answer);
        } catch (error) {
          this._logger.error(`We can't send reply of ${subject}: `, error)
          return false
        }
      } else {
        try {
          await ctx.answerCbQuery(answer)
        } catch (error) {
          this._logger.error(`We can't send the reply of ${subject}: `, error)
          return false
        }
      }
    } catch (error) {
      this._logger.error("Unexpected error of sending telegram reply: ", error)
      return false
    }
    return true
  }

  private async _fetchTelegramSubscribers(ctx: Context) {
    try {
      let memberStatus: 'member' | 'left' | 'not' | 'creator'
      try {
        memberStatus = await this._memberInChannelStatus(ctx.from.id);
      } catch (error) {
        this._logger.error("We can't get the status of the member: ", error)
        if (! await this._sendReply(ctx, "TEXT", "failure of member status in telegram", "Sorry we can't check your member status")) return;
        return
      }
      if (memberStatus === "left" || memberStatus === "not") {
        if (! await this._sendReply(ctx, "TEXT", "failure of member status in telegram", "Failed: You should join the channel first!")) return;
        return
      }
      const sender = { id: ctx.from.id, username: ctx.from.username, status: memberStatus }

      let socialProfile: SocialProfileEntity
      try {
        socialProfile = await this._entityManager.getRepository(SocialProfileEntity).findOneOrFail({
          where: {
            socialType: SocialType.TELEGRAM,
            socialId: `${sender.id}`
          }
        })
      } catch (error) {
        if (error instanceof EntityNotFoundError) {
          await this._sendReply(ctx, "TEXT", "failure of not registered user", "You must register to our platform first!");
        } else {
          this._logger.error("Can't get social profile from the database", error);
          await this._sendReply(ctx, "TEXT", "failure of getting social profile from the database", "Sorry we can't get your social profile from the database!");
        }
        return
      }
      let followRule: SocialAirdropRuleEntity
      try {
        followRule = await this._entityManager.getRepository(SocialAirdropRuleEntity).findOneOrFail({
          where: {
            socialType: SocialType.TELEGRAM,
            actionType: SocialActionType.FOLLOW,
          }
        })
      } catch (error) {
        this._logger.error("Can't get the following social airdrop rule from the database", error);
        await this._sendReply(ctx, "TEXT", "failure of getting telegram follower rule", "Sorry we can't get telegram follow rule from the database!");
        return
      }
      let socialEvent: SocialEventEntity
      try {
        socialEvent = await this._entityManager.createQueryBuilder(SocialEventEntity, "socialEvent")
          .select()
          .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "socialEvent"."airdropScheduleId"')
          .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
          .where('"socialLively"."socialType" = \'TELEGRAM\'')
          .andWhere('"socialEvent"."isActive" = \'true\'')
          .andWhere('("socialEvent"."content"->\'data\'->>\'hashtags\')::jsonb ? ("airdropSchedule"."hashtags"->>\'join\')::text')
          .andWhere('"airdropSchedule"."airdropEndAt" > NOW()')
          .getOneOrFail()
      } catch (error) {
        this._logger.error("Can't get the social event from the database:", error);
        await this._sendReply(ctx, "TEXT", "failure of getting social event from the database", "Sorry we can't get social event from the database!");
        return
      }
      let socialTracker: SocialTrackerEntity
      try {
        socialTracker = await this._entityManager.getRepository(SocialTrackerEntity).findOne({
          relations: {
            socialEvent: true,
            socialProfile: true
          },
          loadEagerRelations: true,
          where: {
            actionType: SocialActionType.FOLLOW,
            socialEvent: {
              id: socialEvent.id
            },
            socialProfile: {
              id: socialProfile.id
            }
          }
        })
      } catch (error) {
        this._logger.error("Can't get the following social airdrop rule from the database", error);
        await this._sendReply(ctx, "TEXT", "failure of getting telegram follower rule", "Sorry we can't get telegram follow rule from the database!");
        return
      }
      if (socialTracker) {
        await this._sendReply(ctx, "TEXT", "failure of submitted before social tracker", "Your subscribe airdrop submitted before!")
        return
      }
      try {
        await this._entityManager.transaction(async (manager) => {
          try {
            socialTracker = await manager.getRepository(SocialTrackerEntity).save({
              actionType: SocialActionType.FOLLOW,
              socialEvent: socialEvent,
              socialProfile: socialProfile
            })
          } catch (error) {
            this._logger.error("We can't insert new telegram social tracker: ", error)
            if (! await this._sendReply(ctx, "TEXT", "failure of submitting telegram social tracker status", "Failed: We can't submit your action in our database!")) return;
            return
          }
          try {
            await manager.getRepository(SocialAirdropEntity).save({
              airdropRule: followRule,
              socialTracker: socialTracker,
            })
          } catch (error) {
            this._logger.error("We can't insert new telegram airdrop: ", error)
            if (! await this._sendReply(ctx, "TEXT", "failure of submitting telegram airdrop", "Failed: Sorry we can't insert the airdrop into the database")) return;
            return
          }
        })
      } catch (error) {
        this._logger.error("Saving telegram social tracker with transaction failed: ", error)
        if (! await this._sendReply(ctx, "TEXT", "failure of submitting telegram social tracker with transaction", "Failed: Sorry we can't insert the social tracker into the database")) return;
        return
      }
      this._sendReply(ctx, "TEXT", "success of submitted follow social airdrop", "Your follow airdrop submitted successfully!")
      return
    } catch (error) {
      this._logger.error("We have unexpected error:", error);
      await this._sendReply(ctx, "TEXT", "unexpected error", "Sorry we an internal error!");
      return
    }
  }
}
