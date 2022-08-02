import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { AirdropService } from "./airdrop.service";
import { ContentDto } from "./domain/dto/content.dto";
import { TwitterUserProfileDto } from "./domain/dto/twitterUserProfile.dto";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { SocialFollowerEntity } from "./domain/entity/socialFollower.entity";
import { EntityManager, Repository } from "typeorm";
import { SocialProfileEntity, SocialType } from "../profile/domain/entity/socialProfile.entity";
import { UserEntity } from "../profile/domain/entity";
import { SocialLivelyEntity } from "./domain/entity/socialLively.entity";

@Controller('/api/airdrop')
export class AirdropController {
  constructor(
    private readonly airdropService: AirdropService,
    @InjectRepository(SocialFollowerEntity)
    readonly followerRepository: Repository<SocialFollowerEntity>,
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
    //
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
    //
    // let socialLively = new SocialLivelyEntity();
    // socialLively.socialType = SocialType.TWITTER;
    // socialLively.username = "Lively_verse";
    // socialLively.userId = "1473018554303885316";
    // socialLively.profileName = "LivelyVerse";
    // socialLively.profileUrl = "https://twitter.com/Lively_verse";
    //
    // result = await this.entityManager
    //   .createQueryBuilder()
    //   .insert()
    //   .into(SocialLivelyEntity)
    //   .values([socialLively])
    //   .execute();
    //
    // socialLively.id = result?.identifiers[0]?.id
    // console.log(`insert socialLively result: ${JSON.stringify(result)}`);
    //
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

    // let socialResult = await this.entityManager
    //   .createQueryBuilder(SocialFollowerEntity, "socialFollower")
    //   .select('"socialProfile"."id" as "profileId", "socialProfile"."username", "socialFollower"."id" as "followerId"')
    //   .leftJoin("social_profile", "socialProfile", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
    //   .where('"socialProfile"."username" = :username', {username: "Twitter Tester 2"})
    //   .getRawAndEntities()


    let socialResult = await this.entityManager
      .getRepository(SocialProfileEntity)
      .createQueryBuilder("socialProfile")
      .select('"socialProfile".*')
      .addSelect('"socialFollower"."id" as "followerId"')
      .leftJoin("social_follower", "socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
      .where('"socialProfile"."username" = :username', {username: "Twitter Tester 3"})
      .getRawOne()

    // let socialResult = await this.entityManager
    //   .createQueryBuilder(SocialProfileEntity, "socialProfile")
    //   .where('"socialProfile"."username" = :username', {username: "Twitter Tester 2"})
    //   .innerJoin(SocialFollowerEntity,"socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
    //   .getOne()
    console.log(`social Result: ${socialResult}`);
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
