import { Injectable, CACHE_MANAGER, Inject, CacheInterceptor } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Client, Options, GatewayIntentBits, Events, Message, Interaction, MessageReaction, GuildMember } from 'discord.js';
import { EntityManager, EntityNotFoundError, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';

@Injectable()
export class DiscordMemberJob {
    private readonly _logger = new Logger(DiscordMemberJob.name);
    private readonly _token;
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
        this._bot.on(Events.ClientReady, async () => {
            if (!this._bot.user || !this._bot.application) {
                return;
            }

            this._logger.log(`${this._bot.user.username} is online`);
        });
        this._bot.on(Events.MessageCreate, async (message: Message) => {
            if (message.author.bot) return;
            this._logger.debug("Received message:", JSON.stringify(message))
            if (message.content === "ping") {
                message.reply("Pong!");
            }
        })
        this._bot.on(Events.InteractionCreate, (interaction: Interaction) => {
            this._logger.debug("Received interaction:", JSON.stringify(interaction))
        });
        this._bot.on(Events.MessageReactionAdd, async (messageReaction: MessageReaction) => {
            this._logger.debug("Received messageReaction from:", JSON.stringify(messageReaction.users.cache.last()), messageReaction.emoji, messageReaction.message)
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
        this._bot.login(this._token);
    }

}