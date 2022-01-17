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

  // app.use((req, res, next) => {
  //   res.header('Access-Control-Allow-Origin', '*');
  //   res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  //   res.header(
  //     'Access-Control-Allow-Headers',
  //     'Origin, X-Requested-With, Content-Type, ',
  //   );
  //   res.header('Access-Control-Expose-Headers', 'Authorization');
  //   next();
  // });

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
    preflightContinue: true,
    optionsSuccessStatus: 204,
  });
  await app.listen(
    config.get<number>('http.port'),
    config.get<string>('http.host'),
  );
}

bootstrap();
