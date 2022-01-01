import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import yamlReader from './config/yamlReader';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ProfileModule,
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
        entities: [configService.get<string>('db.postgres.entities')],
        logging: configService.get<boolean>('db.postgres.logging'),
        migrationsRun: configService.get<boolean>('db.postgres.migrationsRun'),
        synchronize: configService.get<boolean>('db.postgres.synchronize'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {}
