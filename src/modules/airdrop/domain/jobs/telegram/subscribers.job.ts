import { Injectable, Logger } from '@nestjs/common';
import { Timeout } from '@nestjs/schedule';
import { Telegram, Telegraf, Scenes, session, Context } from 'telegraf';
import { InlineKeyboardButton } from 'typegram';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, MoreThan } from 'typeorm';
import { SocialProfileEntity, SocialType } from '../../../../profile/domain/entity/socialProfile.entity'
import { SocialEventEntity } from '../../entity/socialEvent.entity';
import { SocialActionType } from '../../entity/enums';
import { SocialAirdropScheduleEntity } from '../../entity/socialAirdropSchedule.entity';
import { SocialTrackerEntity } from '../../entity/socialTracker.entity';

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
  ){
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
    this.findNewSubscribers();
  }

  // this function should register all the middleware and actions to react to the users activity
  @Timeout(1000)
  async findNewSubscribers() {
    this._logger.debug("findNewSubscribers started!!!")
    try {
      // create stage from all scenes
      const stage = new Scenes.Stage<Scenes.SceneContext>([this.createAirdropScene()]);

      // session middleware will create a session for each user
      this._bot.use(session());

      // register stage middleware
      this._bot.use(stage.middleware());

      // on call bot for first time
      this._bot.start(async (ctx) => {
        // this._logger.debug('Started By', JSON.stringify(ctx));
        await ctx.sendMessage('welcome', {
          reply_markup: {
            keyboard: [[{ text: 'new airdrop 🤑' }, { text: 'new post 🤓' }]],
            resize_keyboard: true,
          },
        });
      });

      // creating new airdrop post
      this._bot.hears('new airdrop 🤑', (ctx) => {
        if (!this._admins.includes(ctx.update.message.from.id)) return;
        (ctx as any).scene.enter('createAirdrop', { user_id: ctx.update.message.from.id });
      });

      // listening to the airdrop post click
      this.registerOnAirdropPostClicked()

      // this.bot.hears('new post 🤓', (ctx) => ctx.reply('post clicked'));

      this.registerListenerForNewMember();

      // await this.createInviteLink();

      // this.registerAction('next');

      await this._bot.launch();
    } catch (error) {
      console.log('error on telegram: ', error);
    }
  }

  /**
   * remove join and leave notification on super group
   */
  registerRemoveJoinAndLeftMessages() {
    this._bot.on(['left_chat_member', 'new_chat_members'], async (ctx) => {
      try {
        await ctx.telegram.deleteMessage(ctx.update.message.chat.id, ctx.update.message.message_id);
        await ctx.telegram.sendMessage(
          this._owner,
          `chat member ${
            (ctx.update.message as any).new_chat_member
              ? (ctx.update.message as any).new_chat_member.username
              : (ctx.update.message as any).left_chat_member.username
          } : ${(ctx.update.message as any).new_chat_member ? 'joined' : 'left'}`,
        );
      } catch (error) {
        console.log('error on remove log: ', error);
      }
    });
  }

  /**
   * listens to join new members in super group
   */
  registerListenerForNewMember() {
    this._bot.on('new_chat_members', (ctx) => {
      console.log('ctx.chatJoinRequest.from:', ctx.update.message);
    });
  }

  postWithButton(btnText: string, btnCallbackData: string, postText: string) {
    this._telegram.callApi('sendMessage', {
      chat_id: this._channelName,
      reply_markup: {
        inline_keyboard: [[{ text: btnText, callback_data: btnCallbackData }]],
      },
      text: postText,
      allow_sending_without_reply: true,
    });
  }

  registerAction(callback: string) {
    this._bot.action(callback, async (ctx) => {
      console.log('action next clicked');
      try {
        const user = ctx.update.callback_query.from;
        console.log('ctx is: ', user);
        const result = await ctx.answerCbQuery();
        ctx.reply(`next clicked by @${user.username} with user id ${user.id}: ${user.first_name} ${user.last_name}`);
        console.log('result is: ', result);
      } catch (error) {}
    });
  }

  // send a simple message to channel
  async sendMessageToChannel(msg: string) {
    await this._telegram.sendMessage(this._channelName, msg);
  }

  createAirdropScene() {
    return new Scenes.WizardScene<any>(
      'createAirdrop',
      async (ctx) => {
        await ctx.reply("Type the event's tile: ");
        return ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.title = ctx.update.message.text;
        await ctx.reply('provide an image or send "none": ');
        await ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.image = ctx.update.message.photo ? ctx.update.message.photo[1] : ctx.update.message.text;
        await ctx.reply('provide an action button text: ');
        await ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.button = ctx.update.message.text;
        const state = ctx.scene.state;
        console.log('data is: ', state);

        const schedule = await this._entityManager.getRepository(SocialAirdropScheduleEntity)
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
        })

        if (!schedule) {
          ctx.reply("We are not in any schedule right now!");
          return ctx.scene.leave();
        }

        const post = await this.createAirdropPost(state.image.file_id ? state.image.file_id : state.image, state.title, state.button);
        if (!post) {
          ctx.reply("Faild to post the event!")
          return ctx.scene.leave();
        }
        const event = await this._entityManager.getRepository(SocialEventEntity).save({
          publishedAt: new Date(),
          contentId: post.message_id,
          content: ctx.scene.state.image,
          airdropSchedule: schedule,
        })
        if (!event) {
          ctx.reply("Can't create this event into the database!")
          await ctx.telegram.deleteMessage(this._channelName, post.message_id);
          return ctx.scene.leave();
        }
        this._logger.debug("Created event is:", JSON.stringify(event))
        ctx.reply(`The event posted successfuly: t.me/${this._channelName.slice(1)}/${post.message_id}`)
        return ctx.scene.leave();
      },
    );
  }

  // creating air drop post with image, caption and button
  async createAirdropPost(source: string, caption: string, btnText: string) {
    let result
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
      console.log('error on create air drop post: ', error);
      return false;
    }
  }

  /**
   * react to the airdrop post clicked
   * you can retrieve the user data from ctx.callbackQuery.from
   * every time user clicked the button it will trigger this action
   */

  registerOnAirdropPostClicked() {
    this._bot.action('airdrop_clicked', async(ctx: Context) => 
    {
    const memberStatus = await this.memberInChannelStatus(ctx.callbackQuery.from.id);
    if (memberStatus === "left" || memberStatus === "not") {
      ctx.answerCbQuery("Faild: You should join the channel first!")
      return
    }
    const sender = {id: ctx.callbackQuery.from.id, username: ctx.callbackQuery.from.username, status: memberStatus}
    const event = await this._entityManager.getRepository(SocialEventEntity)
    .findOne({
      relations: {
        airdropSchedule: true
      },
      loadEagerRelations: true,
     where: {
      contentId: `${ctx.callbackQuery.message.message_id}`
     }
    })
    if (!event) {
      ctx.answerCbQuery("Faild: Can't find the event!!");
      return;
    }
    if (event.airdropSchedule.airdropEndAt <= new Date()) {
      ctx.answerCbQuery("Faild: The schedule of this event had been expired!")
      return;
    }
    this._logger.debug('air drop clicked by', sender.id, sender.username);
    const socialProfile = await this._entityManager
    .getRepository(SocialProfileEntity).findOne({
      where: {
        socialType: SocialType.TELEGRAM,
        socialId: `${sender.id}`,
      }
    })
    if (!socialProfile) {
      ctx.answerCbQuery("Failed: You should register at our platform first!")
      return;
    }
    let socialTracker = await this._entityManager.getRepository(SocialTrackerEntity)
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
    if (socialTracker) {
      ctx.answerCbQuery("Success: You'r action submited before!")
      return;
    }
    socialTracker = await this._entityManager.getRepository(SocialTrackerEntity).save({
      actionType: SocialActionType.REACTION,
      socialEvent: event,
      socialProfile: socialProfile
    })
    if (!socialTracker) {
      ctx.answerCbQuery("Failed: We can't sumbit your action in our database!")
      return;
    }
    ctx.answerCbQuery("Success: You'r action submited successfuly!")
  })
  }
  /**
   * create invite link, its just usable for one time
   */
  async createInviteLink(channel?: string): Promise<string> {
    const result = await this._telegram.callApi('createChatInviteLink', {
      chat_id: channel ?? this._channelName,
    });
    return result.invite_link;
  }

  /**
   * @param id, check if member is in channel by his user id
   * also username is supported, just pass the user name as id
   */
  async memberInChannelStatus(id: number): Promise<'member' | 'left' | 'not' | 'creator'> {
    try {
      const result = await this._telegram.getChatMember(this._channelName, id);
      if (result.status === 'left') return 'left';
      else if (result.status === 'member') return 'member';
      else if (result.status === 'creator') return 'creator';
      else return 'not';
    } catch (error) {
      return 'not';
    }
  }

  sendMessageWithButtonAndPhoto(imageUrl: string, buttons: InlineKeyboardButton[][], caption: string) {
    // inline_keyboard: [
    //   [
    //     { text: '👍', callback_data: 'qwe' },
    //     { text: '👎', callback_data: 'asd' },
    //   ],
    // ],

    this._bot.start((ctx) => {
      ctx.sendPhoto(imageUrl, {
        caption: caption,
        reply_markup: {
          inline_keyboard: buttons,
          resize_keyboard: true,
        },
      });
    });
  }

  sendMessageWithButton() {
    this._bot.command('like', (ctx) => {
      ctx.reply('Hi there!', {
        reply_markup: {
          inline_keyboard: [
            /* Inline buttons. 2 side-by-side */
            // [
            //   { text: 'Button 1', callback_data: 'btn-1' },
            //   { text: 'Button 2', callback_data: 'btn-2' },
            // ],
            /* One button */
            // it needs a registered action to respond to this callback_data
            [{ text: '👍', callback_data: 'next' }],
            // [Markup.callbackButton('Test', 'test')],
            // [m.callbackButton('Test 2', 'test2')],
            /* Also, we can have URL buttons. */
            // [{ text: 'Open in browser', url: 'telegraf.js.org' }],
          ],
        },
      });
    });
  }
}
