import { TokenExpiredError } from 'jsonwebtoken';
import * as crypto from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
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
import { AuthMailEntity } from './domain/entity/authMailEntity';
import { GroupService } from '../profile/services/group.service';
import * as argon2 from 'argon2';
import { TokenResponse } from './authentication.controller';
import { PasswordDto } from './domain/dto/password.dto';
import { logger } from 'handlebars';
import { validate } from 'class-validator';
import { LoginDto } from "./domain/dto/login.dto";

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
  private readonly _mailTokenTTL;
  constructor(
    @InjectRepository(TokenEntity)
    private readonly tokenRepository: Repository<TokenEntity>,
    @InjectRepository(AuthMailEntity)
    private readonly authMailRepository: Repository<AuthMailEntity>,
    private readonly userService: UserService,
    private readonly groupService: GroupService,
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
    this._mailTokenTTL = this.configService.get<number>('app.mailTokenTTL');
  }

  get publicKey() {
    return this._publicKey;
  }

  public async changeUserPassword(
    token: string,
    dto: PasswordDto,
  ): Promise<void> {
    if (dto instanceof Array) {
      this.logger.log(
        `changeUserPassword Data Invalid, username: ${dto.username}`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const errors = await validate(dto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `changeUserPassword validation failed, username: ${dto.username}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input Data Invalid', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenPayload = await this.authTokenValidation(token, false);
    const user = await this.getUserFromTokenPayload(tokenPayload);

    if (!user) {
      this.logger.log(`user not found, userId: ${tokenPayload.sub}`);
      throw new ForbiddenException('User Invalid');
    }

    if (!user.isActive) {
      this.logger.log(`user deactivated, username: ${user.username}`);
      throw new ForbiddenException('User Invalid');
    }

    if (user.username !== dto.username) {
      this.logger.warn(
        `requested username doesn't match with user auth token, token user: ${user.username}, dto: ${dto.username}`,
      );
      throw new ForbiddenException('Illegal Auth Token');
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.oldPassword);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${user.username}`, err);
      throw new InternalServerErrorException('Something went wrong');
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${user.username}`,
      );
      throw new ForbiddenException('Username Or Password Invalid');
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(dto.newPassword);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${dto.username}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    user.password = hashPassword;
    await this.userService.updateEntity(user);
  }

  public async userAuthentication(dto: LoginDto): Promise<TokenResponse> {
    if (dto instanceof Array) {
      this.logger.log(
        `userAuthentication Data Invalid, username: ${dto.username}`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const errors = await validate(dto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `userAuthentication data validation failed, username: ${dto.username}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input Data Invalid', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.userService.findByName(dto.username);

    if (!user) {
      this.logger.log(`user not found, username: ${dto.username}`);
      throw new NotFoundException('Username Or Password Invalid');
    }

    if (!user.isActive) {
      this.logger.log(
        `user deactivated or not confirmed, username: ${dto.username}`,
      );
      throw new NotFoundException('Username Or Password Invalid');
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.password);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${dto.username}`, err);
      throw new InternalServerErrorException('Something went wrong');
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${dto.username}`,
      );
      throw new NotFoundException('Username Or Password Invalid');
    }

    if (user.isEmailConfirmed) {
      const { refreshToken, tokenEntity } = await this.generateRefreshToken(
        user,
      );
      const accessToken = await this.generateAccessToken(user, tokenEntity);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    }

    const authMailEntity = await this.createAuthMailEntity(user);
    const authMailToken = await this.generateAuthMailToken(
      user,
      authMailEntity,
    );
    return {
      access_token: authMailToken,
      refresh_token: null,
    };
  }

  public async revokeAuthToken(userId: string): Promise<TokenEntity> {
    const userEntity = await this.userService.findById(userId);

    if (!userEntity) {
      this.logger.log(`user for revoke token not found, userId: ${userId}`);
      throw new NotFoundException('User Not Found');
    }

    if (!userEntity.token) {
      this.logger.log(`user token not found, userId: ${userId}`);
      throw new NotFoundException('Token Not Found');
    }

    const tokenEntity = userEntity.token;
    tokenEntity.isRevoked = true;
    try {
      return this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.log(`user token not found, userId: ${userId}`);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async authMailCodeConfirmation(
    accessToken: TokenPayload,
    verifyCode: string,
  ): Promise<AuthMailEntity> {
    if (!accessToken.jti || accessToken.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Illegal Auth Token');
    }

    let authMail;
    try {
      authMail = await this.authMailRepository.findOne({ id: accessToken.jti });
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.findOne failed, id: ${accessToken.jti}`,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (authMail.verifyCode !== verifyCode) {
      throw new UnauthorizedException('Illegal Verify Code');
    }

    if (!authMail.user.isActive) {
      throw new UnauthorizedException();
    }

    let memberGroup;
    try {
      memberGroup = await this.groupService.findByName('MEMBER');
    } catch (error) {
      this.logger.error(
        `groupService.findByName for MEMBER group failed, authMail: ${JSON.stringify(
          authMail,
        )}`,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    try {
      authMail.isConfirmed = true;
      authMail.user.isEmailConfirmed = true;
      authMail.user.group = memberGroup;
      return await this.authMailRepository.save(authMail);
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.save failed, authMail: ${JSON.stringify(
          authMail,
        )}`,
      );
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async accessTokenValidation(
    payload: TokenPayload,
  ): Promise<UserEntity | null> {
    if (!payload.sub) {
      this.logger.log(`payload.sub invalid, payload: ${payload}`);
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const userEntity = await this.userService.findById(payload.sub);
    if (
      userEntity &&
      userEntity.isEmailConfirmed &&
      userEntity.isActive &&
      userEntity.token &&
      !userEntity.token.isRevoked &&
      payload.exp * 1000 > Date.now()
    ) {
      return userEntity;
    }

    return null;
  }

  public async authTokenValidation(
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
      this.logger.error(`jwt.verifyAsync failed, token: ${token}`, error);
      // if (e instanceof TokenExpiredError) {
      //   throw new UnauthorizedException('Illegal Auth Token');
      // } else {
      throw new UnauthorizedException('Illegal Auth Token');
      // }
    }
  }

  public async resolveRefreshToken(
    encoded: string,
  ): Promise<{ user: UserEntity; tokenEntity: TokenEntity }> {
    const payload = await this.authTokenValidation(encoded, false);
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
      Date.now() >= tokenEntity.refreshTokenExpiredAt.getTime() ||
      payload.jti != tokenEntity.refreshTokenId
    ) {
      this.logger.log(
        `tokenEntity is revoked or expired or invalid, tokenEntity: ${JSON.stringify(
          tokenEntity,
        )}, payload: ${JSON.stringify(payload)}`,
      );
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const user = await this.getUserFromTokenPayload(payload);

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

  public async generateAuthMailToken(
    user: UserEntity,
    authMail: AuthMailEntity,
  ): Promise<string> {
    const payload = {
      iss: 'https://livelyplanet.io',
      sub: user.id,
      aud: 'https://livelyplanet.io',
      exp: Math.floor(authMail.expiredAt.getTime() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      jti: authMail.id,
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
      exp: Math.floor(tokenEntity.refreshTokenExpiredAt.getTime() / 1000),
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

  public async createAccessTokenFromRefreshToken(
    dto: RefreshDto,
  ): Promise<string> {
    const { user, tokenEntity } = await this.resolveRefreshToken(
      dto.refresh_token,
    );

    return await this.generateAccessToken(user, tokenEntity);
  }

  public async createAuthMailEntity(user: UserEntity): Promise<AuthMailEntity> {
    const authMail = new AuthMailEntity();
    authMail.user = user;
    authMail.from = this.configService.get<string>('mail.from');
    authMail.sendTo = user.email;
    authMail.verificationId = String(
      Math.floor(100000 + Math.random() * 900000),
    );
    authMail.expiredAt = new Date(Date.now() + this._mailTokenTTL);
    authMail.isConfirmed = false;
    authMail.isActive = true;
    authMail.isUpdatable = true;

    try {
      return await this.authMailRepository.save(authMail);
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.save failed, entity: ${JSON.stringify(
          authMail,
        )}`,
      );
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async getUserFromTokenPayload(
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
    // const userId = payload.sub;

    if (!refreshTokenId) {
      this.logger.log(`payload invalid, payload: ${payload}`);
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const user = await this.getUserFromTokenPayload(payload);
    if (!user.token) {
      return null;
    }
    return user.token;
  }
}
