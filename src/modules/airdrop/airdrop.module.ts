import { Module } from '@nestjs/common';
import { SocialLivelyService } from './services/socialLively.service';
import { SocialLivelyController } from './controllers/socialLively.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocialLivelyEntity } from "./domain/entity/socialLively.entity";
import { SocialEventEntity } from "./domain/entity/socialEvent.entity";
import { SocialTrackerEntity } from "./domain/entity/socialTracker.entity";
import { SocialAirdropEntity } from "./domain/entity/socialAirdrop.entity";
import { SocialAirdropRuleEntity } from "./domain/entity/socialAirdropRule.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";
import { TwitterFollowerJob } from "./domain/jobs/twitter/twitterFollower.job";
import { TweetTrackerJob } from "./domain/jobs/twitter/tweetTracker.job";
import { SocialAirdropJob } from "./domain/jobs/socialAirdrop.job";
import { AirdropRuleService } from "./services/airdropRule.service";
import { AirdropRuleController } from "./controllers/airdropRule.controller";
import { AirdropService } from "./services/airdrop.service";
import { AirdropController } from "./controllers/airdrop.controller";
import { InstagramPostTrackerJob } from "./domain/jobs/instagram/instagramPostTracker.job";
import { SocialAirdropScheduleEntity } from "./domain/entity/socialAirdropSchedule.entity";
import { AirdropScheduleController } from "./controllers/airdropSchedule.controller";
import { AirdropScheduleService } from "./services/airdropSchedule.service";
import { InstagramFollowerJob } from "./domain/jobs/instagram/instagramFollower.job";

@Module({
  imports: [
    ProfileModule,
    ConfigModule,
    BlockchainModule,
    TypeOrmModule.forFeature([
      SocialLivelyEntity,
      SocialEventEntity,
      SocialTrackerEntity,
      SocialAirdropEntity,
      SocialAirdropRuleEntity,
      SocialAirdropScheduleEntity
    ]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get('airdrop.httpTimeout'),
      }),
      inject: [ConfigService],
    })
  ],
  controllers: [
    SocialLivelyController,
    AirdropRuleController,
    AirdropController,
    AirdropScheduleController
  ],
  providers: [
    SocialLivelyService,
    AirdropRuleService,
    AirdropService,
    AirdropScheduleService,
    // TwitterFollowerJob,
    // TweetTrackerJob,
    // SocialAirdropJob,
    InstagramPostTrackerJob,
    InstagramFollowerJob
  ]
})
export class AirdropModule {}
