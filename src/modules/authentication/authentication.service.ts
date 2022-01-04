import { TokenExpiredError } from 'jsonwebtoken';
import * as crypto from 'crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Algorithm } from 'jsonwebtoken';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import { UserService } from '../profile/services/user.service';
import { UserEntity } from '../profile/domain/entity/user.entity';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenEntity } from './domain/entity/token.entity';
import { Repository } from 'typeorm';
import { RefreshDto } from './domain/dto/refresh.dto';

export interface TokenPayload {
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
  jti: string;
  sub: string;
  data: object;
}

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);
  private readonly _privateKey;
  private readonly _publicKey;
  private readonly _refreshTokenTTL;
  private readonly _accessTokenTTL;
  constructor(
    @InjectRepository(TokenEntity)
    private readonly tokenRepository: Repository<TokenEntity>,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this._privateKey = fs.readFileSync(
      join(
        process.cwd(),
        '/dist/resources/',
        this.configService.get<string>('app.privateKey'),
      ),
    );
    this._publicKey = fs.readFileSync(
      join(
        process.cwd(),
        '/dist/resources/',
        this.configService.get<string>('app.publicKey'),
      ),
    );

    this._accessTokenTTL = this.configService.get<number>('app.accessTokenTTL');
    this._refreshTokenTTL = this.configService.get<number>(
      'app.refreshTokenTTL',
    );
  }

  get publicKey() {
    return this._publicKey;
  }

  public async revokeUserToken(userId: string): Promise<TokenEntity> {
    const tokenEntity = await this.findRefreshTokenById(userId);
    if (!tokenEntity) {
      this.logger.log(`user token not found, userId: ${userId}`);
      throw new NotFoundException('Token Not Found');
    }

    tokenEntity.isRevoked = true;
    try {
      return this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.log(`user token not found, userId: ${userId}`);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async accessTokenValidation(payload: any): Promise<UserEntity | null> {
    let tokenEntity;
    try {
      tokenEntity = await this.findRefreshTokenById(payload.sub);
    } catch (error) {
      return null;
    }

    if (tokenEntity.isRevoked || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    const user = await this.userService.findById(payload.sub);
    if (user && user.isEmailConfirmed && user.isActive) {
      return user;
    }
    return null;
  }

  public async createTokenEntity(user: UserEntity): Promise<TokenEntity> {
    let tokenEntity;
    try {
      tokenEntity = await this.tokenRepository.findOne({
        where: { userId: user.id },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, user: ${JSON.stringify(user)}`,
        error,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!tokenEntity) {
      tokenEntity = new TokenEntity();
      tokenEntity.userId = user.id;
    }

    tokenEntity.isRevoked = false;
    tokenEntity.refreshTokenExpires = new Date(
      Date.now() + this._refreshTokenTTL,
    );
    tokenEntity.refreshTokenId = crypto.randomUUID({
      disableEntropyCache: true,
    });

    try {
      return await this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(
        `tokenRepository.save failed, token: ${JSON.stringify(tokenEntity)}`,
        error,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findRefreshTokenById(
    userId: string,
  ): Promise<TokenEntity | null> {
    try {
      return await this.tokenRepository.findOne({
        where: { userId: userId },
      });
    } catch (error) {
      this.logger.error(`tokenRepository.findOne failed`, error);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async generateAccessToken(
    user: UserEntity,
    tokenEntity: TokenEntity,
  ): Promise<string> {
    const payload = {
      iss: 'https://livelyplanet.io',
      sub: user.id,
      aud: 'https://livelyplanet.io',
      exp: Math.floor(Date.now() + this._accessTokenTTL) / 1000,
      nbf: Math.floor(Date.now() / 1000),
      jti: tokenEntity.id,
    };
    const option = {
      algorithm: 'ES512' as Algorithm,
      privateKey: this._privateKey,
    };
    try {
      return await this.jwt.signAsync(payload, option);
    } catch (error) {
      this.logger.error(`jwt.signAsync failed, payload: ${payload}`, error);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async generateRefreshToken(
    user: UserEntity,
  ): Promise<{ refreshToken: string; tokenEntity: TokenEntity }> {
    const tokenEntity = await this.createTokenEntity(user);

    const payload = {
      iss: 'https://livelyplanet.io',
      sub: user.id,
      aud: 'https://livelyplanet.io',
      exp: Math.floor(tokenEntity.refreshTokenExpires.getTime() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      jti: tokenEntity.refreshTokenId,
    };

    const option = {
      algorithm: 'ES512' as Algorithm,
      privateKey: this._privateKey,
    };

    const refreshToken = await this.jwt.signAsync(payload, option);
    return { refreshToken, tokenEntity };
  }

  public async resolveRefreshToken(
    encoded: string,
  ): Promise<{ user: UserEntity; tokenEntity: TokenEntity }> {
    const payload = await this.decodeAuthToken(encoded, false);
    const tokenEntity = await this.getStoredTokenFromRefreshTokenPayload(
      payload,
    );

    if (!tokenEntity) {
      this.logger.log(
        `tokenEntity not found, tokenEntity: ${JSON.stringify(tokenEntity)}`,
      );
      throw new UnauthorizedException('Illegal Auth token');
    }

    if (
      tokenEntity.isRevoked ||
      Date.now() >= tokenEntity.refreshTokenExpires.getTime() ||
      payload.jti != tokenEntity.refreshTokenId
    ) {
      this.logger.log(
        `tokenEntity is revoked or expired or invalid, tokenEntity: ${JSON.stringify(
          tokenEntity,
        )}, payload: ${JSON.stringify(payload)}`,
      );
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const user = await this.getUserFromRefreshTokenPayload(payload);

    if (!user || !user.isEmailConfirmed || !user.isActive) {
      this.logger.log(
        `user not found or deactivated or not email confirmed, userId: ${JSON.stringify(
          payload.sub,
        )}`,
      );
      throw new UnauthorizedException('Illegal Auth Token');
    }

    return { user, tokenEntity };
  }

  public async createAccessTokenFromRefreshToken(
    dto: RefreshDto,
  ): Promise<string> {
    const { user, tokenEntity } = await this.resolveRefreshToken(
      dto.refresh_token,
    );

    return await this.generateAccessToken(user, tokenEntity);
  }

  public async decodeAuthToken(
    token: string,
    ignoreExpiration: boolean,
  ): Promise<TokenPayload> {
    const option = {
      algorithm: 'ES512' as Algorithm,
      publicKey: this.publicKey,
      ignoreExpiration: ignoreExpiration,
    };
    try {
      return await this.jwt.verifyAsync(token, option);
    } catch (error) {
      this.logger.error(`jwt.verifyAsync failed, token: ${token}`, error)
      // if (e instanceof TokenExpiredError) {
      //   throw new UnauthorizedException('Illegal Auth Token');
      // } else {
      throw new UnauthorizedException('Illegal Auth Token');
      // }
    }
  }

  private async getUserFromRefreshTokenPayload(
    payload: TokenPayload,
  ): Promise<UserEntity> {
    const subId = payload.sub;

    if (!subId) {
      this.logger.log(`payload.sub invalid, payload: ${payload}`);
      throw new UnauthorizedException('Illegal Auth Token');
    }

    return this.userService.findById(subId);
  }

  private async getStoredTokenFromRefreshTokenPayload(
    payload: TokenPayload,
  ): Promise<TokenEntity | null> {
    const refreshTokenId = payload.jti;
    const userId = payload.sub;

    if (!refreshTokenId || !userId) {
      this.logger.log(`payload invalid, payload: ${payload}`);
      throw new UnauthorizedException('Illegal Auth Token');
    }

    return this.findRefreshTokenById(userId);
  }
}
