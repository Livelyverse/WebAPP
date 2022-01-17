import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import RoleGuard from '../../authentication/domain/gurads/role.guard';
import { JwtAuthGuard } from '../../authentication/domain/gurads/jwt-auth.guard';
import { GroupCreateDto } from '../domain/dto/groupCreate.dto';
import { ContactDto } from '../domain/dto/contact.dto';
import { validate } from 'class-validator';
import { SentMessageInfo } from 'nodemailer';

@ApiTags('/api/profile/contact')
@Controller('/api/profile/contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async sendMail(@Body() contactDto: ContactDto): Promise<void> {
    const dto = ContactDto.from(contactDto);
    if (!dto) {
      this.logger.log(
        `request sendMail contact up invalid, ${JSON.stringify(contactDto)}`
      );
      throw new BadRequestException('Invalid Input Date');
    }

    const errors = await validate(dto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `Contact Us validation failed, dto: ${JSON.stringify(
          dto,
        )}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input data validation failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    let info: SentMessageInfo;
    try {
      info = await this.mailService.sendContactUs(
        contactDto.name,
        contactDto.email,
        contactDto.message,
      );
    } catch (error) {
      this.logger.error(
        `sendContactUs done, name: ${dto.name}, from: ${dto.email}`,
        error,
      );
    }

    this.logger.log(
      `sendContactUs done, name: ${dto.name}, from: ${
        dto.email
      }, result: ${JSON.stringify(info)}`,
    );
  }
}
