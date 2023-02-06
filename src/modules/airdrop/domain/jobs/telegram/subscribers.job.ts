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
import { ContentDto } from '../../dto/content.dto';
import { AirdropScheduleService } from '../../../services/airdropSchedule.service';

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
    private readonly _scheduleService: AirdropScheduleService,
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
    this._findNewSubscribers();
  }

  // this function should register all the middleware and actions to react to the users activity
  @Timeout(1000)
  private async _findNewSubscribers() {
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
          this._logger.error("Can't send welcome message: ", error)
        }
      });

      // creating new airdrop post
      this._bot.hears('new airdrop event post 🤑', (ctx) => {
        if (!this._admins.includes(ctx.update.message.from.id)) return;
        (ctx as any).scene.enter('createAirdrop', { user_id: ctx.update.message.from.id });
      });

      // listening to the airdrop post click
      this._registerOnAirdropPostClicked()

      await this._bot.launch();
    } catch (error) {
      this._logger.error('error on telegram: ', error);
    }
  }

  /**
   * remove join and leave notification on super group
   */
  private _registerRemoveJoinAndLeftMessages() {
    this._bot.on(['left_chat_member', 'new_chat_members'], (ctx) => {
      try {
        ctx.telegram.deleteMessage(ctx.update.message.chat.id, ctx.update.message.message_id);
        ctx.telegram.sendMessage(
          this._owner,
          `chat member ${(ctx.update.message as any).new_chat_member
            ? (ctx.update.message as any).new_chat_member.username
            : (ctx.update.message as any).left_chat_member.username
          } : ${(ctx.update.message as any).new_chat_member ? 'joined' : 'left'}`,
        );
      } catch (error) {
        this._logger.debug('error on remove log: ', error);
      }
    });
  }

  /**
   * listens to join new members on super group
   */
  private _registerListenerForNewMember() {
    this._bot.on('new_chat_members', (ctx: Context) => {
      const member = { id: ctx.from.id, username: ctx.from.username }
      this._logger.debug('New memeber:', member.id, member.username);
    });
  }

  private _createAirdropScene() {
    return new Scenes.WizardScene<any>(
      'createAirdrop',
      (ctx) => {
        ctx.reply("Type the event's title: ");
        return ctx.wizard.next();
      },
      (ctx) => {
        ctx.scene.state.title = ctx.update.message.text;
        ctx.reply('provide an image or send "none": ');
        ctx.wizard.next();
      },
      (ctx) => {
        ctx.scene.state.image = ctx.update.message.photo ? ctx.update.message.photo[1] : ctx.update.message.text;
        ctx.reply('provide an action button text: ');
        ctx.wizard.next();
      },
      (ctx) => {
        ctx.scene.state.button = ctx.update.message.text;
        const state = ctx.scene.state;
        this._entityManager.getRepository(SocialAirdropScheduleEntity)
          .findOne({
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
          }).then(schedule => {
            if (!schedule) {
              ctx.reply("We are not in any schedule right now!");
              return ctx.scene.leave();
            }

            this._createAirdropPost(state.image.file_id ? state.image.file_id : state.image, state.title, state.button)
              .then(post => {
                if (!post) {
                  ctx.reply("Failed to post the event!")
                  return ctx.scene.leave();
                }
                this._logger.debug("Post is:", JSON.stringify(post))
                const content = ContentDto.fromMedia(ctx.scene.state.image)

                this._entityManager.getRepository(SocialEventEntity).insert({
                  publishedAt: new Date(),
                  contentId: `${post.message_id}`,
                  content: content,
                  airdropSchedule: schedule,
                }).then(event => {
                  if (!event) {
                    ctx.reply("Can't create this event into the database!")
                    ctx.telegram.deleteMessage(this._channelName, post.message_id);
                    return ctx.scene.leave();
                  }
                  ctx.reply(`The event posted successfully: t.me/${this._channelName.slice(1)}/${post.message_id}`)
                }).catch(e => {
                  this._logger.error("We can't insert new event from telegram:", e)
                  ctx.reply(`We can't create this event into the database!: ${JSON.stringify(e)}`)
                  ctx.telegram.deleteMessage(this._channelName, post.message_id);
                  return ctx.scene.leave();
                })
              }).catch(e => {
                this._logger.error("Failed to post the event:", e)
                ctx.reply(`Failed to post the event: ${JSON.stringify(e)}`)
                return ctx.scene.leave();
              })
          }).catch(e => {
            this._logger.error("We can't schedule from telegram:", e)
            ctx.reply(`We can't schedule from telegram: ${JSON.stringify(e)}`)
            return ctx.scene.leave();
          })
      },
    );
  }

  // creating air drop post with image, caption and button
  private _createAirdropPost(source: string, caption: string, btnText: string) {
    let result: Promise<SendTelegramMessage>
    source === "none" ?
      result = this._telegram.sendMessage(this._channelName, caption, {
        reply_markup: {
          inline_keyboard: [[{ text: btnText, callback_data: 'airdrop_clicked' }]],
        },
      })
      :
      result = this._telegram.sendPhoto(this._channelName, source, {
        caption,
        reply_markup: {
          inline_keyboard: [[{ text: btnText, callback_data: 'airdrop_clicked' }]],
        },
      })
    return result
  }

  /**
   * react to the airdrop post clicked
   * you can retrieve the user data from ctx.callbackQuery.from
   * every time user clicked the button it will trigger this action
   */

  private _registerOnAirdropPostClicked() {
    this._bot.action('airdrop_clicked', (ctx: Context) => {
      const memberStatus = this._memberInChannelStatus(ctx.callbackQuery.from.id);
      if (memberStatus === "left" || memberStatus === "not") {
        // try catch
        ctx.answerCbQuery("Failed: You should join the channel first!")
        return
      }
      const sender = { id: ctx.callbackQuery.from.id, username: ctx.callbackQuery.from.username, status: memberStatus }
      this._entityManager
        .getRepository(SocialProfileEntity).findOneOrFail({
          where: {
            socialType: SocialType.TELEGRAM,
            socialId: `${sender.id}`,
          }
        }).then(socialProfile => {
          this._entityManager.getRepository(SocialEventEntity)
            .findOneOrFail({
              relations: {
                airdropSchedule: true
              },
              loadEagerRelations: true,
              where: {
                contentId: `${ctx.callbackQuery.message.message_id}`
              }
            }).then(event => {
              if (event.airdropSchedule.airdropEndAt <= new Date()) {
                ctx.answerCbQuery("Failed: The schedule of this event had been expired!")
                return;
              }
              this._logger.debug('air drop clicked by', sender.id, sender.username);
              this._entityManager.getRepository(SocialTrackerEntity)
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
                }).then(socialTracker => {
                  if (socialTracker) {
                    ctx.answerCbQuery("Success: You'r action submited before!")
                    return;
                  }
                  this._entityManager.getRepository(SocialAirdropRuleEntity).findOneOrFail({
                    where: {
                      socialType: SocialType.TELEGRAM,
                      actionType: SocialActionType.LIKE,
                    }
                  }).then(likeRule => {
                    this._entityManager.getRepository(SocialTrackerEntity).save({
                      actionType: SocialActionType.LIKE,
                      socialEvent: event,
                      socialProfile: socialProfile
                    }).then(socialTracker => {
                      if (!socialTracker) {
                        ctx.answerCbQuery("Failed: We can't sumbit your action in our database!")
                        return;
                      }
                      this._entityManager.getRepository(SocialAirdropEntity).insert({
                        airdropRule: likeRule,
                        socialTracker: socialTracker,
                      }).then(airdrop => {
                        ctx.answerCbQuery("Success: You'r action submited successfuly!")
                        return
                      }).catch(e => {
                        ctx.answerCbQuery("Failed: Sorry we can't sumbit your airdrop in our database, Please report to the Admin!")
                        this._logger.error("can't submit social tracker into the database: ", e)
                        return;
                      })
                    }).catch(e => {
                      ctx.answerCbQuery("Failed: We can't sumbit your action in our database, Please report to the Admin!")
                      this._logger.error("can't submit social tracker into the database: ", e)
                      return;
                    })
                  }).catch(e => {
                    ctx.answerCbQuery("Failed: Sorry we can't find the reaction rule from the database, Please report this to the admin")
                    this._logger.error("can't get like rule from the database: ", e)
                    return
                    // likeRule find
                  })
                }).catch(e => {
                  ctx.answerCbQuery("Failed: getting social tracker failed!");
                  this._logger.error("can't get socail tracker from the database: ", e)
                  return;
                })
            }).catch(e => {
              ctx.answerCbQuery("Failed: Can't find the event!");
              this._logger.error("can't get event from the database: ", e)
              return;
            })
        }).catch(e => {
          if (e instanceof EntityNotFoundError) {
            ctx.answerCbQuery("Failed: You should register at our platform first!")
          } else {
            ctx.answerCbQuery("Failed: We can't get your social profile, Please report this to the Admin!")
            this._logger.error("can't get social profile from the database: ", e)
          }
          return;
        })
    })
  }

  /**
   * @param id, check if member is in channel by his user id
   * also username is supported, just pass the user name as id
   */
  private _memberInChannelStatus(id: number): 'member' | 'left' | 'not' | 'creator' {
    let result: 'member' | 'left' | 'not' | 'creator'
    this._telegram.getChatMember(this._channelName, id)
      .then((member) => {
        if (member.status === 'left') result = 'left';
        else if (member.status === 'member') result = 'member';
        else if (member.status === 'creator') result = 'creator';
        else result = 'not';
      }).catch(() => result = 'not')
    return result
  }
}
