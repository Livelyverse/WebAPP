import { SocialAirdropEntity } from "../entity/socialAirdrop.entity";
import { ApiResponseProperty } from "@nestjs/swagger";

export enum AirdropFilterType {
  USER_ID = 'userId',
  SOCIAL_ACTION = 'socialAction',
  SOCIAL_TYPE = 'socialType'
}


export class AirdropInfoViewDto {
  static from(entity: SocialAirdropEntity): AirdropInfoViewDto | null {
    if(entity) {
      const airdropDto = new AirdropInfoViewDto();
      airdropDto.id = entity.id;
      airdropDto.email = entity.socialTracker.socialProfile.user.email;
      airdropDto.userId = entity.socialTracker.socialProfile.user.id;
      airdropDto.socialName = entity.socialTracker.socialProfile.socialName;
      airdropDto.socialUsername = entity.socialTracker.socialProfile.username;
      airdropDto.socialAction = entity.socialTracker.actionType;
      airdropDto.socialType = entity.socialTracker.socialProfile.socialType;
      airdropDto.wallet = entity.socialTracker.socialProfile.user.walletAddress;
      airdropDto.amount = entity.airdropRule.amount.toString();
      airdropDto.unit = entity.airdropRule.unit;
      airdropDto.txHash = entity?.blockchainTx?.txHash ? entity.blockchainTx.txHash : null;
      airdropDto.txTimestamp = entity?.blockchainTx?.createdAt ? entity.blockchainTx.createdAt : null;
      airdropDto.timestamp = entity.createdAt;
      airdropDto.contentId = entity.socialTracker?.socialEvent?.contentId ? entity.socialTracker.socialEvent.contentId : null;
      airdropDto.contentUrl = entity.socialTracker?.socialEvent?.contentUrl ? entity.socialTracker.socialEvent.contentUrl : null;
      airdropDto.contentPublishedAt = entity.socialTracker?.socialEvent?.publishedAt ? entity.socialTracker.socialEvent.publishedAt : null;
      return airdropDto;
    }

    return null;
  }

  @ApiResponseProperty()
  id: string;

  @ApiResponseProperty()
  email: string;

  @ApiResponseProperty()
  userId: string;

  @ApiResponseProperty()
  socialName: string;

  @ApiResponseProperty()
  socialUsername: string;

  @ApiResponseProperty()
  socialAction: string;

  @ApiResponseProperty()
  socialType: string;

  @ApiResponseProperty()
  wallet: string;

  @ApiResponseProperty()
  amount: string;

  @ApiResponseProperty()
  unit: string;

  @ApiResponseProperty()
  txHash: string;

  @ApiResponseProperty()
  txTimestamp: Date;

  @ApiResponseProperty()
  contentId: string;

  @ApiResponseProperty()
  contentUrl: string;

  @ApiResponseProperty()
  contentPublishedAt: Date;

  @ApiResponseProperty()
  timestamp: Date;
}