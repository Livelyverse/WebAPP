import { ApiProperty } from "@nestjs/swagger";

export class MediumRssCreateDto {
  image?: MediumRssImageDto;
  paginationLinks?: MediumRssPaginationLinks;
  link?: string;
  title?: string;
  items: MediumRssItemDto[];
  feedUrl?: string;
  description?: string;
  itunes?: {
    [key: string]: any;
    image?: string;
    owner?: {
      name?: string;
      email?: string;
    };
    author?: string;
    summary?: string;
    explicit?: string;
    categories?: string[];
    keywords?: string[];
  };
}

export class MediumRssImageDto {
  @ApiProperty()
  public link?: string;

  @ApiProperty()
  public url: string;

  @ApiProperty()
  public title?: string;
}

export class MediumRssItemDto {
  @ApiProperty()
  public link: string;

  @ApiProperty()
  public guid: string;

  @ApiProperty()
  public thumbnail: string;

  @ApiProperty()
  public title: string;

  @ApiProperty()
  public pubDate: string;

  @ApiProperty()
  public creator: string;

  @ApiProperty()
  public summary: string;

  @ApiProperty()
  public content: string;

  @ApiProperty()
  public isoDate: string;

  @ApiProperty()
  public categories: string[];

  @ApiProperty()
  public contentSnippet: string;

 // @ApiProperty()
  public enclosure?: MediumRssEnclosureDto;
}

export class MediumRssEnclosureDto {
  @ApiProperty()
  public url: string;

  @ApiProperty()
  public length?: number;

  @ApiProperty()
  public type?: string;
}

export class MediumRssPaginationLinks {
  self?: string;
  first?: string;
  next?: string;
  last?: string;
  prev?: string;
}
