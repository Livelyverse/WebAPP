import { Injectable, Logger } from '@nestjs/common';
import { Timeout } from '@nestjs/schedule';
import { Telegram, Telegraf, Scenes, session, Context } from 'telegraf';
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

class SendTelegramMessage {
  message_id: number
}

@Injectable()
export class TelegramSubscriberJob {
  private readonly _logger = new Logger(TelegramSubscriberJob.name);
  private readonly _token;
  private readonly _channelName: string;
  private readonly _bot;
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
  @Timeout(1000)
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
          await ctx.sendMessage('welcome', {
            reply_markup: {
              keyboard: [[{ text: 'new airdrop event post 🤑' }]],
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
        try {
          await ctx.reply("Type the event's tile: ");
          return ctx.wizard.next();
        } catch (error) {
          this._logger.error("We can't send reply of entering event post in telegram: ", error)
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          ctx.scene.state.title = ctx.update.message.text;
          await ctx.reply('provide an image or send "none": ');
          await ctx.wizard.next();
        } catch (error) {
          this._logger.error("We can't send reply of sending image of event post in telegram: ", error)
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          ctx.scene.state.image = ctx.update.message.photo ? ctx.update.message.photo[1] : ctx.update.message.text;
          await ctx.reply('provide an action button text: ');
          await ctx.wizard.next();
        } catch (error) {
          this._logger.error("We can't send reply of getting button of event post in telegram: ", error)
          return ctx.scene.leave();
        }
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
            try {
              if (error instanceof EntityNotFoundError) {
                await ctx.reply("We are not in any active schedule right now. Make a schedule first.")
              } else {
                this._logger.error("We can't get schedule from the database: ", error)
                await ctx.reply(`We can't send reply of entering event post in telegram: ${error}`);
              }
            } catch (error) {
              this._logger.error("We can't send reply of failure of getting schedule in telegram: ", error)
            }
            return ctx.scene.leave();
          }

          let post: SendTelegramMessage
          try {
            post = await this._createAirdropPost(state.image.file_id ? state.image.file_id : state.image, state.title, state.button);
          } catch (error) {
            this._logger.error("We can't create an event post in telegram: ", error)
            try {
              await ctx.reply(`We can't send create an event post in telegram channel: ${error}`);
            } catch (error) {
              this._logger.error("We can't send reply of failure of creating an event post in telegram channel: ", error)
            }
            return ctx.scene.leave();
          }

          try {
            await this._entityManager.getRepository(SocialEventEntity).insert({
              publishedAt: new Date(),
              contentId: `${post.message_id}`,
              content: ctx.scene.state.image,
              airdropSchedule: schedule,
            })
          } catch (error) {
            this._logger.error("We can't insert an event in database: ", error)
            try {
              await ctx.reply(`We can't insert an event in database: ${error}`);
            } catch (error) {
              this._logger.error("We can't send reply of failure of inserting an event in database: ", error)
            }
            return ctx.scene.leave();
          }

          try {
            await ctx.reply(`The event posted successfully: t.me/${this._channelName.slice(1)}/${post.message_id}`)
          } catch (error) {
            this._logger.error("We can't send reply of result of created post: ", error)
          }

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
          try {
            await ctx.answerCbQuery("Failed: You should join the channel first!")
          } catch (error) {
            this._logger.error("We can't send the reply of failure of member status in telegram: ", error)
          }
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
          try {
            await ctx.answerCbQuery("Failed: Can't find the event!!");
          } catch (error) {
            this._logger.error("We can't send the reply of failure of getting the event", error)
          }
          return
        }
        if (event.airdropSchedule.airdropEndAt <= new Date()) {
          try {
            await ctx.answerCbQuery("Failed: The schedule of this event had been expired!")
          } catch (error) {
            this._logger.error("We can't send the reply of expired schedule", error)
          }
          return;
        }
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
          try {
            if (error instanceof EntityNotFoundError) {
              await ctx.answerCbQuery("Failed: You should register at our platform first!")
            } else {
              this._logger.error("We can't get the social profile from the database:", error)
              await ctx.answerCbQuery("Failed: Sorry we can't get the social profile from the database")
            }
          } catch (error) {
            this._logger.error("We can't send the reply of failure of getting social profile", error)
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
            try {
              await ctx.answerCbQuery("Failed: Sorry we have some problems of getting social tracker status")
            } catch (error) {
              this._logger.error("We can't send the reply of failure of getting telegram social tracker status: ", error)
            }
            return;
          }
        }
        if (socialTracker) {
          ctx.answerCbQuery("Success: You'r action submitted before!")
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
          try {
            await ctx.answerCbQuery("Failed: Sorry we have some problems of getting telegram like rule")
          } catch (error) {
            this._logger.error("We can't send the reply of failure of getting telegram like rule: ", error)
          }
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
              try {
                await ctx.answerCbQuery("Failed: We can't submit your action in our database!")
              } catch (error) {
                this._logger.error("We can't send the reply of failure of submitting telegram social tracker status: ", error)
              }
              return
            }

            try {
              await manager.getRepository(SocialAirdropEntity).save({
                airdropRule: likeRule,
                socialTracker: socialTracker,
              })
            } catch (error) {
              this._logger.error("We can't insert new telegram airdrop: ", error)
              try {
                await ctx.answerCbQuery("Failed: Sorry we can't insert the airdrop into the database")
              } catch (error) {
                this._logger.error("We can't send the reply of failure of submitting telegram airdrop: ", error)
              }
              return
            }
          })
        } catch (error) {
          this._logger.error("Saving telegram social tracker with transaction failed: ", error)
          try {
            await ctx.answerCbQuery("Failed: Sorry we can't insert the social tracker into the database")
          } catch (error) {
            this._logger.error("We can't send the reply of failure of submitting telegram social tracker with transaction: ", error)
          }
          return
        }

        try {
          await ctx.answerCbQuery("Success: You'r action submitted successfully!")
        } catch (error) {
          this._logger.error("We can't send the reply of submitted action: ", error)
          return
        }
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
}
