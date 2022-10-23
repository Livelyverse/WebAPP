import { CacheModule, CacheStore, Module } from "@nestjs/common";
import { redisStore } from 'cache-manager-redis-store';
import { ConfigModule, ConfigService } from '@nestjs/config';
import yamlReader from './config/yamlReader';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileModule } from './modules/profile/profile.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { MailModule } from './modules/mail/mail.module';
import { BlogModule } from './modules/blog/blog.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AirdropModule } from './modules/airdrop/airdrop.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { APP_MODE, BlockchainConfig } from "./modules/blockchain/blockchainConfig";
import { RedisClientOptions } from "redis";
@Module({
  imports: [
    AuthenticationModule.forRoot('jwt'),
    ScheduleModule.forRoot(),
    MailModule,
    ProfileModule,
    BlogModule,
    AirdropModule,
    ConfigModule.forRoot({
      load: [yamlReader],
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      // name: "postgresDatasource",
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('db.postgres.host'),
        port: parseInt(configService.get<string>('db.postgres.port')),
        username: configService.get<string>('db.postgres.profile'),
        password: configService.get<string>('db.postgres.password'),
        database: configService.get<string>('db.postgres.database'),
        entities: [configService.get<string>('db.postgres.entity')],
        logging: configService.get<boolean>('db.postgres.logging'),
        migrationsRun: configService.get<boolean>('db.postgres.migrationsRun'),
        synchronize: configService.get<boolean>('db.postgres.synchronize'),
        autoLoadEntities: configService.get<boolean>(
          'db.postgres.autoLoadEntities',
        ),
      }),
      inject: [ConfigService],
    }),
    BlockchainModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        let blockchainConfig = configService.get<BlockchainConfig>('blockchain');
        let mode;
        let envMode = configService.get<string>('WEB_APP_ENV_MODE').toUpperCase();
        if (envMode === "DEV" || envMode === "TEST" || envMode === "PROD") {
          mode = envMode as APP_MODE
        } else {
          throw new Error('Invalid WEB_APP_ENV_MODE variable');
        }
        return {
          appMode: mode,
          config: blockchainConfig
        }
      },
      inject: [ConfigService]
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          store: "none",
          socket: {
            host: configService.get<string>('app.cache.host'),
            port: configService.get<number>('app.cache.port'),
          },
        }) as unknown as CacheStore,
        ttl: configService.get<number>('app.cache.ttl'),
      }),
      isGlobal: true,
      inject: [ConfigService],
    })
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
