import { Module } from '@nestjs/common';
import { AirdropService } from './airdrop.service';
import { AirdropController } from './airdrop.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocialLivelyEntity } from "./domain/entity/socialLively.entity";
import { SocialFollowerEntity } from "./domain/entity/socialFollower.entity";
import { SocialEventEntity } from "./domain/entity/socialEvent.entity";
import { SocialTrackerEntity } from "./domain/entity/socialTracker.entity";
import { SocialScheduleEntity } from "./domain/entity/SocialSchedule.entity";
import { SocialAirdropEntity } from "./domain/entity/socialAirdrop.entity";
import { SocialAirdropRuleEntity } from "./domain/entity/socialAirdropRule.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";
import { TwitterFollowerJob } from "./domain/jobs/twitter/follower.job";

@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule,
    BlockchainModule,
    TypeOrmModule.forFeature([
      SocialLivelyEntity,
      SocialFollowerEntity,
      SocialEventEntity,
      SocialTrackerEntity,
      SocialScheduleEntity,
      SocialAirdropEntity,
      SocialAirdropRuleEntity
    ]),
  ],
  controllers: [AirdropController],
  providers: [AirdropService, TwitterFollowerJob]
})
export class AirdropModule {}
