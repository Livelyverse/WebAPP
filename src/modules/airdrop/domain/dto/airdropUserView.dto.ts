import { ApiResponseProperty } from "@nestjs/swagger";
import { SocialAirdropUserView } from "../../services/airdrop.service";

export enum AirdropUserFilterType {
  SOCIAL_ACTION = 'socialAction',
  SOCIAL_TYPE = 'socialType'
}

export enum AirdropEventStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED'
}

export class AirdropUserViewDto {
  static from(entity: SocialAirdropUserView): AirdropUserViewDto | null {
    if(entity) {
      const airdropDto = new AirdropUserViewDto();
      airdropDto.eventId = entity.eventId;
      airdropDto.airdropId = entity?.airdropId ? entity.airdropId : null;
      airdropDto.email = entity?.email ? entity?.email : null;
      airdropDto.userId = entity?.userId ? entity.userId : null;
      airdropDto.socialName = entity?.socialName ? entity.socialName : null;
      airdropDto.socialUsername = entity?.socialUsername ? entity.socialUsername : null;
      airdropDto.socialActionType = entity.actionType;
      airdropDto.socialType = entity.socialType;
      airdropDto.wallet = entity?.wallet ? entity.wallet : null;
      airdropDto.amount = entity.amount.toString();
      airdropDto.unit = entity.unit;
      airdropDto.txHash = entity?.txHash ? entity.txHash : null;
      airdropDto.txTimestamp = entity?.txTimestamp ? entity.txTimestamp : null;
      airdropDto.eventContentId = entity.contentId ? entity.contentId : null;
      airdropDto.eventContentUrl = entity.contentUrl ? entity.contentUrl : null;
      airdropDto.socialProfileUrl = entity.socialProfileUrl;
      airdropDto.eventPublishedAt = entity.eventPublishedAt;
      airdropDto.trackingStartedAt = entity.trackingStartedAt;
      airdropDto.trackingEndAt = entity.trackingEndAt;
      airdropDto.eventStatus = entity.eventStatus;
      return airdropDto;
    }

    return null;
  }

  @ApiResponseProperty()
  eventId: string;

  @ApiResponseProperty()
  airdropId: string;

  @ApiResponseProperty()
  email: string;

  @ApiResponseProperty()
  userId: string;

  @ApiResponseProperty()
  socialName: string;

  @ApiResponseProperty()
  socialUsername: string;

  @ApiResponseProperty()
  socialActionType: string;

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
  eventContentId: string;

  @ApiResponseProperty()
  eventContentUrl: string;

  @ApiResponseProperty()
  socialProfileUrl: string;

  @ApiResponseProperty()
  eventPublishedAt: Date;

  @ApiResponseProperty()
  trackingStartedAt: Date;

  @ApiResponseProperty()
  trackingEndAt: Date;

  @ApiResponseProperty()
  eventStatus: AirdropEventStatus;
}