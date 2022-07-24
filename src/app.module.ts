import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import yamlReader from './config/yamlReader';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileModule } from './modules/profile/profile.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { MailModule } from './modules/mail/mail.module';
import { BlogModule } from './modules/blog/blog.module';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [
    AuthenticationModule.forRoot('jwt'),
    ScheduleModule.forRoot(),
    MailModule,
    ProfileModule,
    BlogModule,
    ConfigModule.forRoot({
      load: [yamlReader],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('db.postgres.host'),
        port: parseInt(configService.get<string>('db.postgres.port')),
        username: configService.get<string>('db.postgres.profile'),
        password: configService.get<string>('db.postgres.password'),
        database: configService.get<string>('db.postgres.database'),
        entities: [configService.get<string>('db.postgres.entity')],
        logging: configService.get<boolean>('db.postgres.logging'),
        migrationsRun: configService.get<boolean>('db.postgres.migrationsRun'),
        synchronize: configService.get<boolean>('db.postgres.synchronize'),
        autoLoadEntities: configService.get<boolean>(
          'db.postgres.autoLoadEntities',
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
