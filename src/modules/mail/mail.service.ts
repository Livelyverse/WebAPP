import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  sendCodeConfirmation(username: string, sendTo: string, verifyCode: number) {
    this.mailerService
      .sendMail({
        to: sendTo,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'Welcome to LivelyPlanet Site! Confirm your Email',
        template: 'codeConfirmation', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          name: username,
          code: verifyCode,
        },
      })
      .then((sendMessageInfo) =>
        this.logger.log(
          `mailerService.sendMail done, username: ${username}, sendTo: ${sendTo}, result: ${JSON.stringify(
            sendMessageInfo,
          )}`,
        ),
      )
      .catch((error) =>
        this.logger.error(
          `mailerService.sendMail failed, username: ${username} sendTo: ${sendTo}`,
          error,
        ),
      );
  }

  sendContactUs(name: string, from: string, message: string) {
    this.mailerService
      .sendMail({
        to: this.configService.get<string>('mail.from'),
        // from: from,
        subject: `Form ${name} ContactUs of Site`,
        text: `${name} <${from}> \n${message}`,
      })
      .then((sendMessageInfo) =>
        this.logger.log(
          `sendContactUs done, name: ${name}, from: ${from}, result: ${JSON.stringify(
            sendMessageInfo,
          )}`,
        ),
      )
      .catch((error) =>
        this.logger.error(
          `mailerService.sendMail failed, name: ${name}, from: ${from}`,
          error,
        ),
      );
  }
}
