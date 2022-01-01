import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
/**
 * Service dealing with app config based operations.
 *
 * @class
 */
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}
  get host(): string {
    return this.configService.get<string>('http.host');
  }
  get port(): number {
    return Number(this.configService.get<number>('http.port'));
  }

  public getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.configService.get<string>('db.postgres.url'),
      port: parseInt(this.configService.get<string>('db.postgres.port')),
      username: this.configService.get<string>('db.postgres.profile'),
      password: this.configService.get<string>('db.postgres.password'),
      database: this.configService.get<string>('db.postgres.database'),
      entities: [this.configService.get<string>('db.postgres.entities')],
      synchronize: this.configService.get<boolean>('db.postgres.synchronize'),
    };
  }
}
