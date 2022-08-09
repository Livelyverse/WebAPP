import { TweetEventDto } from "./tweetEvent.dto";

export class ContentDto {
  public data?: any
  public media?: any
  public meta?: any
  public url?: string

  public static from(dto: TweetEventDto): ContentDto {
    const contentDto = new ContentDto();
    contentDto.data = dto;
    return contentDto;
  }
}
