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
// import { SocialFollowerEntity } from "./domain/entity/socialFollower.entity";
import { SocialAirdropJob } from "./domain/jobs/socialAirdrop.job";
import { AirdropRuleService } from "./services/airdropRule.service";
import { AirdropRuleController } from "./controllers/airdropRule.controller";
import { AirdropService } from "./services/airdrop.service";
// import { FollowerService } from "./services/follower.service";
import { AirdropController } from "./controllers/airdrop.controller";
// import { FollowerController } from "./controllers/follower.controller";
import { PostTrackerJob } from "./domain/jobs/instagram/postTracker.job";
import { SocialAirdropScheduleEntity } from "./domain/entity/socialAirdropSchedule.entity";



@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule,
    BlockchainModule,
    TypeOrmModule.forFeature([
      SocialLivelyEntity,
      SocialEventEntity,
      // SocialFollowerEntity,
      SocialTrackerEntity,
      SocialAirdropEntity,
      SocialAirdropRuleEntity,
      SocialAirdropScheduleEntity
    ]),
  ],
  controllers: [
    SocialLivelyController,
    AirdropRuleController,
    AirdropController,
    // FollowerController
  ],
  providers: [
    SocialLivelyService,
    AirdropRuleService,
    AirdropService,
    // FollowerService,
    // TwitterFollowerJob,
    TweetTrackerJob,
    // SocialAirdropJob
    // PostTrackerJob
  ]
})
export class AirdropModule {}
