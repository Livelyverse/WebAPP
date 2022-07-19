import { PartialType } from '@nestjs/swagger';
import { ContentDto } from './content.dto';

export class UpdateAirdropDto extends PartialType(ContentDto) {}
