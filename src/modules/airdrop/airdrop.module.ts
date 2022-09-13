import { Module } from '@nestjs/common';
import { SocialLivelyService } from './services/socialLively.service';
import { SocialLivelyController } from './controllers/socialLively.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocialLivelyEntity } from "./domain/entity/socialLively.entity";
import { SocialEventEntity } from "./domain/entity/socialEvent.entity";
import { SocialTrackerEntity } from "./domain/entity/socialTracker.entity";
import { SocialAirdropEntity } from "./domain/entity/socialAirdrop.entity";
import { SocialAirdropRuleEntity } from "./domain/entity/socialAirdropRule.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";
import { TwitterFollowerJob } from "./domain/jobs/twitter/followerTracker.job";
import { TweetTrackerJob } from "./domain/jobs/twitter/tweetTracker.job";
import { SocialFollowerEntity } from "./domain/entity/socialFollower.entity";
import { SocialAirdropJob } from "./domain/jobs/twitter/socialAirdrop.job";

@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule,
    BlockchainModule,
    TypeOrmModule.forFeature([
      SocialLivelyEntity,
      SocialEventEntity,
      SocialFollowerEntity,
      SocialTrackerEntity,
      SocialAirdropEntity,
      SocialAirdropRuleEntity
    ]),
  ],
  controllers: [SocialLivelyController],
  // providers: [SocialLivelyService, TwitterFollowerJob, TweetTrackerJob, SocialAirdropJob]
  providers: [SocialLivelyService]
})
export class AirdropModule {}
