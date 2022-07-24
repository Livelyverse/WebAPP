import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  MediumRssCreateDto,
  MediumRssImageDto,
  MediumRssItemDto,
  MediumRssPaginationLinks
} from "./mediumRssCreate.dto";
import { BlogEntity, ProtocolType } from "../entity/blog.entity";


export class MediumRssViewDto {
  public static from(blog: BlogEntity): MediumRssViewDto | null {
    if(blog) {
      const rssViewDto = new MediumRssViewDto();
      rssViewDto.name= blog.name;
      rssViewDto.resource= blog.resource;
      rssViewDto.domain= blog.domain;
      rssViewDto.link= blog.link;
      rssViewDto.title= blog.title;
      rssViewDto.feedUrl= blog.feedUrl;
      rssViewDto.description= blog.description;
      rssViewDto.image= blog.image;
      rssViewDto.item= blog.feed;
      rssViewDto.thumbnail = blog.thumbnail;
      rssViewDto.protocol= blog.protocol;
      rssViewDto.version= blog.protocolVersion;
      return rssViewDto;
    }
    return null;
  }

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public resource: string;

  @ApiProperty()
  public domain: string;

  @ApiProperty()
  public link: string;

  @ApiProperty()
  public title: string;

  @ApiProperty()
  public thumbnail: string;

  @ApiProperty()
  public feedUrl: string;

  @ApiProperty()
  public description: string;

  @ApiProperty()
  public image: MediumRssImageDto;

  @ApiProperty()
  public item: MediumRssItemDto;

  @ApiProperty()
  public protocol: string;

  @ApiProperty()
  public version: string;
}
