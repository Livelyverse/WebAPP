import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { DynamicModule, Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from './domain/entity/token.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({})
export class AuthenticationModule {
  static forRoot(strategy?: 'jwt'): DynamicModule {
    strategy = strategy ? strategy : 'jwt';
    const strategyProvider = {
      provide: 'Strategy',
      useFactory: async (authenticationService: AuthenticationService) => {
        const Strategy = (
          await import(`./domain/passports/${strategy}.strategy`)
        ).default;
        return new Strategy(authenticationService);
      },
      inject: [AuthenticationService],
    };
    return {
      module: AuthenticationModule,
      imports: [
        TypeOrmModule.forFeature([TokenEntity]),
        JwtModule.register({ secret: '' }),
        ProfileModule,
        ConfigModule,
      ],
      controllers: [AuthenticationController],
      providers: [AuthenticationService, strategyProvider],
      exports: [strategyProvider],
    };
  }
}
