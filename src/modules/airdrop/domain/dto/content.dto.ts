import { TweetEventDto } from "./tweetEvent.dto";
import { InstagramPostDto } from "./instagramPost.dto";

export class ContentDto {
  public data?: any
  public media?: any
  public meta?: any
  public url?: string

  public static from(dto: TweetEventDto | InstagramPostDto): ContentDto {
    const contentDto = new ContentDto();
    contentDto.data = dto;
    return contentDto;
  }

  public static fromMedia(media: string): ContentDto {
    const contentDto = new ContentDto();
    contentDto.media = media;
    return contentDto;
  }
}
