import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger(bootstrap.name);
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lively API')
    .setDescription('The LivelyVerse.io API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  app.enableCors({
    allowedHeaders: [
      'DNT',
      'User-Agent',
      'X-Requested-With',
      'If-Modified-Since',
      'Cache-Control',
      'Content-Type',
      'Range',
      'Accept',
      'Authorization',
    ],
    exposedHeaders: 'Authorization',
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    maxAge: 1728000,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const uploadPath =
    process.cwd() + '/' + config.get<string>('http.upload.path');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath);
    logger.log(`create ${uploadPath} success . . .`);
  }

  await app.listen(
    config.get<number>('http.port'),
    config.get<string>('http.host'),
  );
}

bootstrap();
