import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { AirdropService } from "./airdrop.service";
import { ContentDto } from "./domain/dto/content.dto";
import { TwitterUserProfileDto } from "./domain/dto/twitterUserProfile.dto";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SocialProfileEntity, SocialType } from "../profile/domain/entity/socialProfile.entity";
import { UserEntity } from "../profile/domain/entity";
import { SocialEventEntity } from "./domain/entity/socialEvent.entity";
import { SocialAirdropRuleEntity } from "./domain/entity/socialAirdropRule.entity";
import { SocialFollowerEntity } from "./domain/entity/socialFollower.entity";
import { SocialActionType, UnitType } from "./domain/entity/enums";
import { SocialLivelyEntity } from "./domain/entity/socialLively.entity";
import * as RxJS from "rxjs";
import { TwitterFollowerError } from "./domain/error/twitterFollower.error";

@Controller('/api/airdrop')
export class AirdropController {
  constructor(
    private readonly airdropService: AirdropService,
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  @Post()
  create(@Body() createAirdropDto: ContentDto) {
    return this.airdropService.create(createAirdropDto);
  }

  @Get('/findAll')
  async findAll() {
    // let user = await this.entityManager.createQueryBuilder(UserEntity, "user")
    //   .where("user.username = :username", { username: "sinatest"})
    //   .getOne()

    // let socialProfile = new SocialProfileEntity();
    // socialProfile.socialType = SocialType.TWITTER;
    // socialProfile.username = "Twitter Tester";
    // socialProfile.user = user;
    //
    // let result = await this.entityManager
    //   .createQueryBuilder()
    //   .insert()
    //   .into(SocialProfileEntity)
    //   .values([socialProfile])
    //   .execute();
    //
    // console.log(`insert socialProfile result: ${JSON.stringify(result)}`);
    // socialProfile.id = result?.identifiers[0]?.id

    // let socialLively = new SocialLivelyEntity();
    // socialLively.socialType = SocialType.TWITTER;
    // socialLively.username = "Lively_verse";
    // socialLively.userId = "1473018554303885316";
    // socialLively.profileName = "LivelyVerse";
    // socialLively.profileUrl = "https://twitter.com/Lively_verse";
    //
    // let result = await this.entityManager
    //   .createQueryBuilder()
    //   .insert()
    //   .into(SocialLivelyEntity)
    //   .values([socialLively])
    //   .execute();
    //
    // socialLively.id = result?.identifiers[0]?.id
    // console.log(`insert socialLively result: ${JSON.stringify(result)}`);

    // let socialFollower = new SocialFollowerEntity();
    // socialFollower.socialProfile = socialProfile;
    // socialFollower.socialLively = socialLively;
    //
    // result = await this.entityManager
    //   .createQueryBuilder()
    //   .insert()
    //   .into(SocialFollowerEntity)
    //   .values([socialFollower])
    //   .execute();
    // console.log(`insert socialFollower result: ${JSON.stringify(result)}`);

    // let socialResult = await this.entityManager
    //   .createQueryBuilder(SocialFollowerEntity, "socialFollower")
    //   .leftJoinAndSelect("socialFollower.socialProfile", "socialProfile")
    //   .where('"socialProfile"."socialUsername" = :username', {username: "Twitter Tester"})
    //   .getOne()
    //
    // let socialResult = await this.entityManager
    //   .createQueryBuilder(SocialFollowerEntity, "socialFollower")
    //   .select('"socialProfile"."id" as "profileId", "socialProfile"."username", "socialFollower"."id" as "followerId"')
    //   .leftJoin("social_profile", "socialProfile", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
    //   .where('"socialProfile"."username" = :username', {username: "Twitter Tester 2"})
    //   .getRawAndEntities()

    // let followRule = new SocialAirdropRuleEntity();
    // followRule.decimal = 18;
    // followRule.socialType = SocialType.TWITTER;
    // followRule.actionType = SocialActionType.FOLLOW;
    // followRule.unit = UnitType.LVL_TOKEN;
    // followRule.amount = 200n;
    //
    // let followLike = new SocialAirdropRuleEntity();
    // followLike.decimal = 18;
    // followLike.socialType = SocialType.TWITTER;
    // followLike.actionType = SocialActionType.LIKE;
    // followLike.unit = UnitType.LVL_TOKEN;
    // followLike.amount = 100n;
    //
    // let followRetweet = new SocialAirdropRuleEntity();
    // followRetweet.decimal = 18;
    // followRetweet.socialType = SocialType.TWITTER;
    // followRetweet.actionType = SocialActionType.RETWEET;
    // followRetweet.unit = UnitType.LVL_TOKEN;
    // followRetweet.amount = 150n;
    //
    // let socialResult = await this.entityManager.createQueryBuilder()
    //   .insert()
    //   .into(SocialAirdropRuleEntity)
    //   .values([followRule, followLike, followRetweet])
    //   .execute()

    let result1 = await this.entityManager.getRepository(UserEntity)
      .findByIds(['77f2bdbd-49da-49ab-9c8f-70d24830de95', '631f1af7-54cf-451d-a618-37073c0c72b1'])
    
    // let user1 = new UserEntity();
    // user1.id = '77f2bdbd-49da-49ab-9c8f-70d24830de95';
    //
    // let user2 = new UserEntity();
    // user2.id = '631f1af7-54cf-451d-a618-37073c0c72b1';

    let socialProfile1 = new SocialProfileEntity();
    socialProfile1.socialType = SocialType.TWITTER;
    socialProfile1.username = 'marianoquadrini';
    socialProfile1.user = result1[0];

    let socialProfile2 = new SocialProfileEntity();
    socialProfile2.socialType = SocialType.TWITTER;
    socialProfile2.username = 'rogiiz16';
    socialProfile2.user = result1[1];

    let socialResult2 = await this.entityManager.getRepository(SocialProfileEntity).insert(socialProfile1);
    let socialResult1 = await this.entityManager.getRepository(SocialProfileEntity).insert(socialProfile2);
      // .insert()
      // .into(SocialProfileEntity)
      // .values([socialProfile1, socialProfile2])
      // .execute()

    // let socialResult = await this.entityManager
    //   .getRepository(SocialProfileEntity)
    //   .createQueryBuilder("socialProfile")
    //   .select('"socialProfile".*')
    //   .addSelect('"socialFollower"."id" as "followerId"')
    //   .leftJoin("social_follower", "socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
    //   .where('"socialProfile"."username" = :username', {username: "Twitter Tester 3"})
    //   .getRawOne()

    // let socialResult = await this.entityManager
    //   .createQueryBuilder(SocialProfileEntity, "socialProfile")
    //   .where('"socialProfile"."username" = :username', {username: "Twitter Tester 2"})
    //   .innerJoin(SocialFollowerEntity,"socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
    //   .getOne()
    console.log(`social Result: ${socialResult2}`);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.airdropService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAirdropDto: TwitterUserProfileDto) {
    return this.airdropService.update(+id, updateAirdropDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.airdropService.remove(+id);
  }
}
