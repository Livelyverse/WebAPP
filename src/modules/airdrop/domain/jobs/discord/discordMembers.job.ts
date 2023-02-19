import { Injectable, CACHE_MANAGER, Inject, Logger, CacheInterceptor } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Client, Options, GatewayIntentBits, Events, Message, Interaction, MessageReaction, GuildMember, TextChannel } from 'discord.js';
import { EntityManager, EntityNotFoundError, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';
import { Timeout } from '@nestjs/schedule';

@Injectable()
export class DiscordMemberJob {
    private readonly _logger = new Logger(DiscordMemberJob.name);
    private readonly _token: string;
    private readonly _publisherRoleId: string;
    private readonly _eventsChannelId: string;
    private readonly _airdropEmojiIdentifier: string;
    private readonly _bot: Client;


    constructor(
        @InjectEntityManager()
        private readonly _entityManager: EntityManager,
        @Inject(CACHE_MANAGER)
        private readonly _cacheManager: Cache,
        private readonly _configService: ConfigService,
    ) {
        this._token = this._configService.get<string>("airdrop.discord.token");
        if (!this._token) {
            throw new Error("airdrop.discord.token config is empty");
        }

        this._publisherRoleId = this._configService.get<string>("airdrop.discord.publisherRoleId");
        if (!this._publisherRoleId) {
            throw new Error("airdrop.discord.publisherRoleId config is empty");
        }

        this._eventsChannelId = this._configService.get<string>("airdrop.discord.eventsChannelId");
        if (!this._eventsChannelId) {
            throw new Error("airdrop.discord.eventsChannelId config is empty");
        }

        this._airdropEmojiIdentifier = this._configService.get<string>("airdrop.discord.airdropEmojiIdentifier");
        if (!this._airdropEmojiIdentifier) {
            throw new Error("airdrop.discord.airdropEmojiIdentifier config is empty");
        }

        this._bot = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers],
            makeCache: Options.cacheWithLimits({
                ...Options.DefaultMakeCacheSettings,
                ReactionManager: 1,
            }),
        });

        this._initializeBot()
    }

    private async _initializeBot() {
        this._logger.debug("initializeBot started!")
        try {
            this._bot.on(Events.ClientReady, async () => {
                if (!this._bot.user || !this._bot.application) {
                    return;
                }

                this._logger.log(`${this._bot.user.username} is online`);
            });
            this._bot.on(Events.Error, async (error: Error) => {
                this._logger.error(`We have an error: ${JSON.stringify(error.stack)}`, error)
            })

            this._bot.on(Events.MessageCreate, async (message: Message) => {
                try {
                    if (message.author.bot) return;
                    if (!message.member.roles.cache.has(this._publisherRoleId)) return;
                    this._logger.debug("Received message:", JSON.stringify(message))
                    if (message.content === "ping") {
                        if (! await this._sendReply(message, "ping (=> Pong!)", "Pong!")) return;
                        return
                    }
                    if (message.content.startsWith("!create")) {
                        const postText = message.content.substring(7).trimStart()
                        const post = await this._sendReply(message, "success create event", postText, this._eventsChannelId)
                        await post.react(this._airdropEmojiIdentifier)
                        if (! post) return;
                        return
                    }
                    return
                } catch (error) {
                    console.log(JSON.stringify(error))
                    this._logger.error("Unexpected error in messageCreateListener:", error)
                    return
                }
            })

            this._bot.on(Events.InteractionCreate, (interaction: Interaction) => {
                this._logger.debug("Received interaction:", JSON.stringify(interaction))
            });
            this._bot.on(Events.MessageReactionAdd, async (messageReaction: MessageReaction) => {
                this._logger.debug("Received messageReaction from:", JSON.stringify(messageReaction.users.cache.last()), messageReaction.emoji.identifier, messageReaction.message)
            })
            this._bot.on(Events.MessageUpdate, async (oldMessage: Message, newMessage: Message) => {
                this._logger.debug("Message updated from:", JSON.stringify(oldMessage), "To:", JSON.stringify(newMessage))
            })
            this._bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
                this._logger.debug("We have a new member:", JSON.stringify(member))
            })
            this._bot.on(Events.GuildMemberRemove, async (member: GuildMember) => {
                this._logger.debug("We have lost a member:", JSON.stringify(member))
            })
            this._bot.on(Events.GuildCreate, async (guildCreate) => {
                this._logger.debug("We have a new GuildCreate:", JSON.stringify(guildCreate))
            })
            await this._bot.login(this._token);
        } catch (error) {
            this._logger.error("Unexpected error in initializeBot:", error)
            return
        }
    }

    private async _sendReply(message: Message, subtitle: string, text: string, to?: string): Promise<Message> {
        let postedMessage: Message
        try {
            if (to) {
                postedMessage = await (this._bot.channels.cache.get(to) as TextChannel).send(text)
            } else {
                postedMessage = await message.reply(text)
            }
        } catch (error) {
            this._logger.error("we can't send the reply of: " + subtitle)
        }
        return postedMessage
    }
}