import { ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post, UsePipes, ValidationPipe
} from "@nestjs/common";
import { MailService } from '../../mail/mail.service';
import { ContactDto } from "../domain/dto";
import { SentMessageInfo } from 'nodemailer';

@ApiTags('/api/profiles/contact')
@Controller('/api/profiles/contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({
    status: 200,
    description: 'Record Created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async sendMail(@Body() contactDto: ContactDto): Promise<void> {
    // const dto = ContactDto.from(contactDto);
    // const errors = await validate(dto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this.logger.log(
    //     `Contact Us validation failed, dto: ${JSON.stringify(
    //       dto,
    //     )}, errors: ${errors}`,
    //   );
    //
    //   throw new HttpException(
    //     { message: 'Input data validation failed', errors },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    let info: SentMessageInfo;
    try {
      info = await this.mailService.sendContactUs(
        contactDto.name,
        contactDto.email,
        contactDto.message,
      );
    } catch (error) {
      this.logger.error(
        `sendContactUs done, name: ${contactDto.name}, from: ${contactDto.email}`,
        error,
      );
      throw new HttpException(
        {
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.log(
      `sendContactUs done, name: ${contactDto.name}, from: ${
        contactDto.email
      }, result: ${JSON.stringify(info)}`,
    );
  }
}
