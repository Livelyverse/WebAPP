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
      airdropDto.username = entity.socialTracker.socialProfile.user.username;
      airdropDto.socialName = entity.socialTracker.socialProfile.socialName;
      airdropDto.socialUsername = entity.socialTracker.socialProfile.username;
      airdropDto.socialAction = entity.socialTracker.actionType;
      airdropDto.socialType = entity.socialTracker.socialProfile.socialType;
      airdropDto.wallet = entity.socialTracker.socialProfile.user.walletAddress;
      airdropDto.amount = entity.airdropRule.amount.toString();
      airdropDto.unit = entity.airdropRule.unit;
      airdropDto.txHash = entity?.blockchainTx?.txHash;
      airdropDto.txTimestamp = entity?.blockchainTx?.createdAt?.toString();
      airdropDto.timestamp = entity.createdAt.toString();
      airdropDto.contentId = entity.socialTracker?.socialEvent?.contentId;
      airdropDto.contentUrl = entity.socialTracker?.socialEvent?.contentUrl;
      airdropDto.contentPublishedAt = entity.socialTracker?.socialEvent?.publishedAt?.toString();
      return airdropDto;
    }

    return null;
  }

  @ApiResponseProperty()
  id: string;

  @ApiResponseProperty()
  username: string;

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
  txTimestamp: string;

  @ApiResponseProperty()
  contentId?: string;

  @ApiResponseProperty()
  contentUrl?: string;

  @ApiResponseProperty()
  contentPublishedAt?: string;

  @ApiResponseProperty()
  timestamp: string;
}