import { Injectable } from '@nestjs/common';
import { Timeout } from '@nestjs/schedule';
import { Telegram, Telegraf, Scenes, session } from 'telegraf';
import { InlineKeyboardButton } from 'typegram';

@Injectable()
export class TelegramSubscriberJob {
  // use @BotFather to get your token, it must be the admin of channel
  private token = '5416659848:AAFMYvWTiX4IBUDrA6Tp4xHKxCGf0eZA2pc';
  // creating bot with generated token
  private bot = new Telegraf(this.token);

  // initializing telegram sdk with the generated token
  private telegram = new Telegram(this.token);

  // admin id that have administrator access to the channel
  private adminId = 896767754;

  private admins = [896767754];

  private channelName = '@livelychanneltest';

  // this function should register all the middleware and actions to react to the users activity
  @Timeout(1000)
  async findNewSubscribers() {
    try {
      // create stage from all scenes
      const stage = new Scenes.Stage<Scenes.SceneContext>([this.createAirdropScene()]);

      // session middleware will create a session for each user
      this.bot.use(session());

      // register stage middleware
      this.bot.use(stage.middleware());

      // on call bot for first time
      this.bot.start(async (ctx) => {
        await ctx.sendMessage('welcome', {
          reply_markup: {
            keyboard: [[{ text: 'new airdrop 🤑' }, { text: 'new post 🤓' }]],
            resize_keyboard: true,
          },
        });
      });

      // creating new airdrop post
      this.bot.hears('new airdrop 🤑', (ctx) => {
        if (this.admins.includes(ctx.update.message.from.id)) return;
        (ctx as any).scene.enter('createAirdrop', { user_id: ctx.update.message.from.id });
      });

      // listening to the airdrop post click
      this.registerOnAirdropPostClicked();

      // this.bot.hears('new post 🤓', (ctx) => ctx.reply('post clicked'));

      this.registerListenerForNewMember();

      // await this.createInviteLink();

      // this.registerAction('next');

      await this.bot.launch();
    } catch (error) {
      console.log('error on telegram: ', error);
    }
  }

  /**
   * remove join and leave notification on super group
   */
  registerRemoveJoinAndLeftMessages() {
    this.bot.on(['left_chat_member', 'new_chat_members'], async (ctx) => {
      try {
        await ctx.telegram.deleteMessage(ctx.update.message.chat.id, ctx.update.message.message_id);
        await ctx.telegram.sendMessage(
          this.adminId,
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
    this.bot.on('new_chat_members', (ctx) => {
      console.log('ctx.chatJoinRequest.from:', ctx.update.message);
    });
  }

  postWithButton(btnText: string, btnCallbackData: string, postText: string) {
    this.telegram.callApi('sendMessage', {
      chat_id: this.channelName,
      reply_markup: {
        inline_keyboard: [[{ text: btnText, callback_data: btnCallbackData }]],
      },
      text: postText,
      allow_sending_without_reply: true,
    });
  }

  registerAction(callback: string) {
    this.bot.action(callback, async (ctx) => {
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
    await this.telegram.sendMessage(this.channelName, msg);
  }

  createAirdropScene() {
    return new Scenes.WizardScene<any>(
      'createAirdrop',
      async (ctx) => {
        await ctx.reply('enter post title: ');
        return ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.title = ctx.update.message.text;
        await ctx.reply('provide an image or send none: ');
        await ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.image = ctx.update.message.photo[1];
        await ctx.reply('provide an action button text: ');
        await ctx.wizard.next();
      },
      async (ctx) => {
        ctx.scene.state.button = ctx.update.message.text;
        const state = ctx.scene.state;
        console.log('data is: ', state);

        await this.createAirdropPost(state.image.file_id, state.title, state.button);
        return ctx.scene.leave();
      },
    );
  }

  // creating air drop post with image, caption and button
  async createAirdropPost(source: string, caption: string, btnText: string) {
    try {
      await this.telegram.sendPhoto(this.channelName, source, {
        caption,
        reply_markup: {
          inline_keyboard: [[{ text: btnText, callback_data: 'airdrop_clicked' }]],
        },
      });
      return true;
    } catch (error) {
      console.log('error on create air drop post: ', error);
      return false;
    }
  }

  /**
   * react to the airdrop post clicked
   * you can retrieve the user data from ctx.update.callback_query.from
   * every time user clicked the button it will trigger this action
   */
  registerOnAirdropPostClicked() {
    this.bot.action('airdrop_clicked', (ctx) => {
      // this.memberIsInChannel(ctx.update.callback_query.from.id);
      console.log('air drop licked by', ctx.update.callback_query.from.id, ctx.update.callback_query.from.username);
    });
  }

  /**
   * create invite link, its just usable for one time
   */
  async createInviteLink(channel?: string): Promise<string> {
    const result = await this.telegram.callApi('createChatInviteLink', {
      chat_id: channel ?? this.channelName,
    });
    return result.invite_link;
  }

  /**
   * @param id, check if member is in channel by his user id
   * also username is supported, just pass the user name as id
   */
  async memberIsInChannel(id: number): Promise<'member' | 'left' | 'not' | 'creator'> {
    try {
      const result = await this.telegram.getChatMember(this.channelName, id);
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

    this.bot.start((ctx) => {
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
    this.bot.command('like', (ctx) => {
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
