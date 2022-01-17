import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lively API')
    .setDescription('The LivelyPlanet.io API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    preflightContinue: true,
    optionsSuccessStatus: 204,
  });
  await app.listen(
    config.get<number>('http.port'),
    config.get<string>('http.host'),
  );
}

bootstrap();
