import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private mailerService: MailerService) {}

  async sendCodeConfirmation(
    username: string,
    sendTo: string,
    verifyCode: number,
  ) {
    const info = await this.mailerService.sendMail({
      to: sendTo,
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to LivelyPlanet App! Confirm your Email',
      template: './codeConfirmation', // `.hbs` extension is appended automatically
      context: {
        // ✏️ filling curly brackets with content
        name: username,
        code: verifyCode,
      },
    });

    this.logger.log(
      `mailerService.sendMail done, username: ${username}, sendTo: ${sendTo}, result: ${JSON.stringify(
        info,
      )}`,
    );
  }
}
