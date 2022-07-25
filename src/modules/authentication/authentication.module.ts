import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { DynamicModule, Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMailEntity, TokenEntity } from './domain/entity';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';

@Module({})
export class AuthenticationModule {
  static forRoot(strategy?: 'jwt'): DynamicModule {
    strategy = strategy ? strategy : 'jwt';
    const strategyProvider = {
      provide: 'Strategy',
      useFactory: async (authenticationService: AuthenticationService) => {
        const Strategy = (
          await import(`./domain/passport/${strategy}.strategy`)
        ).default;
        return new Strategy(authenticationService);
      },
      inject: [AuthenticationService],
    };
    return {
      module: AuthenticationModule,
      imports: [
        TypeOrmModule.forFeature([AuthMailEntity, TokenEntity]),
        JwtModule.register({ secret: '' }),
        MailModule,
        ProfileModule,
        ConfigModule,
      ],
      controllers: [AuthenticationController],
      providers: [AuthenticationService, strategyProvider],
      exports: [strategyProvider],
    };
  }
}
