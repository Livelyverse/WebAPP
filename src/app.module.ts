import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import yamlReader from './config/yamlReader';
import { AppConfigService } from './config/appConfig.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [yamlReader],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
