import { Injectable } from '@nestjs/common';
import { ContentDto } from './domain/dto/content.dto';
import { TwitterUserProfileDto } from './domain/dto/twitterUserProfile.dto';

@Injectable()
export class AirdropService {
  create(createAirdropDto: ContentDto) {
    return 'This action adds a new airdrop';
  }

  findAll() {
    return `This action returns all airdrop`;
  }

  findOne(id: number) {
    return `This action returns a #${id} airdrop`;
  }

  update(id: number, updateAirdropDto: TwitterUserProfileDto) {
    return `This action updates a #${id} airdrop`;
  }

  remove(id: number) {
    return `This action removes a #${id} airdrop`;
  }
}
