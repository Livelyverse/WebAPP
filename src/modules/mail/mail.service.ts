import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private mailerService: MailerService) {}

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
}
