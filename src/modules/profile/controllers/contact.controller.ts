import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
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
    if (contactDto instanceof Array) {
      this.logger.log(
        `sendMail contact up failed, request invalid: ${JSON.stringify(
          contactDto,
        )}`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const errors = await validate(contactDto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `Contact Us validation failed, name: ${contactDto.name}, email: ${contactDto.email}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input data validation failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.mailService.sendContactUs(
      contactDto.name,
      contactDto.email,
      contactDto.message,
    );
  }
}
