import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { ContactDto } from "../domain/dto";
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
      throw new InternalServerErrorException({
        message: 'Something was wrong',
      });
    }

    this.logger.log(
      `sendContactUs done, name: ${dto.name}, from: ${
        dto.email
      }, result: ${JSON.stringify(info)}`,
    );
  }
}
