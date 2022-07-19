import { Injectable } from '@nestjs/common';
import { ContentDto } from './domain/dto/content.dto';
import { UpdateAirdropDto } from './domain/dto/update-airdrop.dto';

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

  update(id: number, updateAirdropDto: UpdateAirdropDto) {
    return `This action updates a #${id} airdrop`;
  }

  remove(id: number) {
    return `This action removes a #${id} airdrop`;
  }
}
