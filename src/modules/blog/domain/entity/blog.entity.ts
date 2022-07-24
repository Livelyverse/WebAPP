import { Column, Entity, UpdateDateColumn } from "typeorm";
import { BaseEntity } from '../../../profile/domain/entity';
import { MediumRssImageDto, MediumRssItemDto } from "../dto/mediumRssCreate.dto";

export enum ProtocolType {
  RSS = 0,
  ATOM = 1,
}

@Entity({ name: 'blog' })
export class BlogEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: false, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  domain: string;

  @Column({ type: 'varchar', length: 2048, unique: false, nullable: false })
  resource: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  title: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 4096, unique: false, nullable: false })
  feedUrl: string;

  @Column({ type: 'varchar', length: 4096, unique: false, nullable: false })
  link: string;

  @Column({ type: 'varchar', length: 4096, unique: false, nullable: false })
  thumbnail: string;

  @Column({ type: 'enum', enum: ProtocolType, unique: false, nullable: false })
  protocol: ProtocolType;

  @Column({ type: 'varchar', length: 32, unique: false, nullable: false })
  protocolVersion: string;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @Column({ type: 'json', unique: false, nullable: false })
  image: MediumRssImageDto;

  @Column({ type: 'jsonb', unique: false, nullable: false })
  feed: MediumRssItemDto;
}
