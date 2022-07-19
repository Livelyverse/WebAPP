import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AirdropService } from './airdrop.service';
import { ContentDto } from './domain/dto/content.dto';
import { UpdateAirdropDto } from './domain/dto/update-airdrop.dto';

@Controller('airdrop')
export class AirdropController {
  constructor(private readonly airdropService: AirdropService) {}

  @Post()
  create(@Body() createAirdropDto: ContentDto) {
    return this.airdropService.create(createAirdropDto);
  }

  @Get()
  findAll() {
    return this.airdropService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.airdropService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAirdropDto: UpdateAirdropDto) {
    return this.airdropService.update(+id, updateAirdropDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.airdropService.remove(+id);
  }
}
