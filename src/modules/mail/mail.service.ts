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

  sendCodeConfirmation(sendTo: string, verifyCode: number) {
    this.mailerService
      .sendMail({
        to: sendTo,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'Welcome to LivelyVerse Site! Confirm your Email',
        template: 'codeConfirmation', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          name: sendTo,
          code: verifyCode,
        },
      })
      .then((sendMessageInfo) =>
        this.logger.log(
          `sendCodeConfirmation mailerService.sendMail done, sendTo: ${sendTo}, result: ${JSON.stringify(
            sendMessageInfo,
          )}`,
        ),
      )
      .catch((error) =>
        this.logger.error(
          `sendCodeConfirmation mailerService.sendMail failed, sendTo: ${sendTo}`,
          error,
        ),
      );
  }

  sendForgetPassword(sendTo: string, resetPassUrl: string) {
    this.mailerService
      .sendMail({
        to: sendTo,
        // from: '"Support Team" <support@example.com>', // override default from
        subject: 'LivelyVerse Reset Password!',
        template: 'forgetPassword', // `.hbs` extension is appended automatically
        context: {
          // ✏️ filling curly brackets with content
          name: sendTo,
          url: resetPassUrl,
        },
      })
      .then((sendMessageInfo) =>
        this.logger.log(
          `sendForgetPassword mailerService.sendMail done, 
           sendTo: ${sendTo}, url: ${resetPassUrl} result: ${JSON.stringify(
            sendMessageInfo,
          )}`,
        ),
      )
      .catch((error) =>
        this.logger.error(
          `sendForgetPassword mailerService.sendMail failed, 
          sendTo: ${sendTo}, url: ${resetPassUrl}`,
          error,
        ),
      );
  }

  async sendContactUs(name: string, from: string, message: string) {
    await this.mailerService.sendMail({
      to: this.configService.get<string>('mail.from'),
      // from: from,
      subject: `From ${name} ContactUs of Site`,
      template: 'contactUs', // `.hbs` extension is appended automatically
      // text: `${name} <${from}> \n${message}`,
      context: {
        name: name,
        email: from,
        message: message,
      },
    });
    // .then((sendMessageInfo) =>
    //   this.logger.log(
    //     `sendContactUs done, name: ${name}, from: ${from}, result: ${JSON.stringify(
    //       sendMessageInfo,
    //     )}`,
    //   ),
    // )
    // .catch((error) =>
    //   this.logger.error(
    //     `mailerService.sendMail failed, name: ${name}, from: ${from}`,
    //     error,
    //   ),
    // );
  }
}
