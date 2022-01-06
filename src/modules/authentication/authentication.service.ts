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
import { Response } from 'express';
import { UserService } from '../profile/services/user.service';
import { UserEntity } from '../profile/domain/entity';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenEntity } from './domain/entity';
import { MoreThan, Repository } from 'typeorm';
import { RefreshDto } from './domain/dto/refresh.dto';
import { AuthMailEntity } from './domain/entity';
import { GroupService } from '../profile/services/group.service';
import * as argon2 from 'argon2';
import { PasswordDto } from './domain/dto/password.dto';
import { validate } from 'class-validator';
import { LoginDto } from './domain/dto/login.dto';
import { UserCreateDto } from '../profile/domain/dto/userCreate.dto';
import { SignupDto } from './domain/dto/signup.dto';
import { MailService } from '../mail/mail.service';
import { ResendAuthMailDto } from './domain/dto/verification.dto';

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
    private readonly mailService: MailService,
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
    let tokenEntity;
    try {
      tokenEntity = await this.tokenRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: tokenPayload.sub },
        },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, userId: ${tokenPayload.sub}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    const user = tokenEntity.user;
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

    tokenEntity.isRevoked = true;
    try {
      return this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(
        `tokenRepository.save failed, tokenEntity Id: ${tokenEntity.id}, userId: ${user.id}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async userAuthentication(
    dto: LoginDto,
    res: Response,
  ): Promise<Response> {
    if (dto instanceof Array) {
      this.logger.log(
        `userAuthentication Data Invalid, username: ${dto.username}`,
      );
      return res.status(HttpStatus.BAD_REQUEST).send('Request Data Invalid');
    }

    const errors = await validate(dto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `userAuthentication data validation failed, username: ${dto.username}, errors: ${errors}`,
      );

      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(`Input Data Invalid, ${JSON.stringify(errors)}`);
    }

    const user = await this.userService.findByName(dto.username);

    if (!user) {
      this.logger.log(`user not found, username: ${dto.username}`);
      return res
        .status(HttpStatus.NOT_FOUND)
        .send('Username Or Password Invalid');
    }

    if (!user.isActive) {
      this.logger.log(`user inactivated, username: ${dto.username}`);
      return res
        .status(HttpStatus.NOT_FOUND)
        .send('Username Or Password Invalid');
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.password);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${dto.username}`, err);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send('Something went wrong');
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${dto.username}`,
      );
      res.status(HttpStatus.NOT_FOUND).send('Username Or Password Invalid');
    }

    if (user.isEmailConfirmed) {
      const { refreshToken, tokenEntity } = await this.generateRefreshToken(
        user,
      );
      const accessToken = await this.generateAccessToken(user, tokenEntity);

      return res.status(HttpStatus.OK).send({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    const authMailEntity = await this.createOrGetAuthMailEntity(user);
    const authMailToken = await this.generateAuthMailToken(
      user,
      authMailEntity,
    );
    return res.status(201).send({
      access_token: authMailToken,
      refresh_token: null,
    });
  }

  public async userSignUp(dto: SignupDto): Promise<string> {
    const userDto = new UserCreateDto();
    userDto.username = dto.username;
    userDto.password = dto.password;
    userDto.email = dto.email;
    userDto.group = 'GHOST';
    const user = await this.userService.create(userDto);
    const authMailEntity = await this.createOrGetAuthMailEntity(user, true);

    this.mailService.sendCodeConfirmation(
      userDto.username,
      userDto.email,
      Number(authMailEntity.verificationId),
    );

    return await this.generateAuthMailToken(user, authMailEntity);
  }

  public async resendMailVerification(
    dto: ResendAuthMailDto,
    token: string,
  ): Promise<void> {
    if (!token) {
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const authMailToken = await this.authTokenValidation(token, false);
    let authMail;
    try {
      authMail = await this.authMailRepository.findOne(authMailToken.jti);
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.findOne failed, id: ${authMailToken.jti}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (!authMail) {
      this.logger.warn(
        `authMail entity of token invalid, authMail id: ${authMailToken.jti}`,
      );
      throw new ForbiddenException();
    }

    if (!dto || !dto.username) {
      throw new BadRequestException('Input Data Invalid');
    }

    const user = authMail.user;
    if (dto.username !== user.username) {
      throw new ForbiddenException();
    }

    if (user.isEmailConfirmed) {
      this.logger.warn(
        `user try again to resend mail verification, userId: ${user.id}`,
      );
      throw new ForbiddenException('Illegal User');
    }

    const authMailEntity = await this.createOrGetAuthMailEntity(user);

    if (authMailEntity.isEmailSent) {
      this.logger.log(
        `mail verification already send to user, userId: ${user.id}, sendTo: ${authMailEntity.sendTo}`,
      );
      return;
    }

    this.mailService.sendCodeConfirmation(
      user.username,
      user.email,
      Number(authMailEntity.verificationId),
    );

    authMailEntity.isEmailSent = true;
    authMailEntity.mailSentAt = new Date();
    try {
      await this.authMailRepository.save(authMailEntity);
    } catch (error) {
      this.logger.error(
        `authMailRepository.save of userSignUp failed, userId: ${user.id}, 
                 authMail Id: ${authMailEntity.id}`,
        error,
      );
    }
  }

  public async revokeAuthToken(userId: string): Promise<TokenEntity> {
    let tokenEntity;
    try {
      tokenEntity = await this.tokenRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: userId },
        },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, userId: ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (!tokenEntity) {
      this.logger.log(`user token not found, userId: ${userId}`);
      throw new NotFoundException('Token Not Found');
    }

    tokenEntity.isRevoked = true;
    try {
      return this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(`user token not found, userId: ${userId}`, error);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  public async authMailCodeConfirmation(
    authMailToken: TokenPayload,
    verifyCode: string,
  ): Promise<AuthMailEntity> {
    if (!authMailToken.jti || authMailToken.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('Illegal Auth Token');
    }

    let authMail;
    try {
      authMail = await this.authMailRepository.findOne(authMailToken.jti);
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.findOne failed, id: ${authMailToken.jti}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (authMail.verificationId !== verifyCode) {
      this.logger.warn(
        `verify code invalid, userId: ${authMailToken.sub}, code: ${verifyCode}`,
      );
      throw new UnauthorizedException();
    }

    if (!authMail.user.isActive) {
      this.logger.warn(`user inactivated, userId: ${authMailToken.sub}`);
      throw new UnauthorizedException();
    }

    let memberGroup;
    try {
      memberGroup = await this.groupService.findByName('MEMBER');
    } catch (error) {
      this.logger.error(
        `groupService.findByName for MEMBER group failed, userId: ${authMail.user.id}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    try {
      authMail.user.isEmailConfirmed = true;
      authMail.user.group = memberGroup;
      return await this.authMailRepository.save(authMail);
    } catch (error) {
      this.logger.error(
        `mailVerificationRepository.save failed, userId: ${authMail.user.id}`,
        error,
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

    let tokenEntity;
    try {
      tokenEntity = await this.tokenRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: payload.sub },
        },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, userId: ${payload.sub}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (
      tokenEntity &&
      !tokenEntity.isRevoked &&
      tokenEntity.id === payload.jti &&
      tokenEntity.user.isEmailConfirmed &&
      tokenEntity.user.isActive &&
      payload.exp * 1000 > Date.now()
    ) {
      return tokenEntity.user;
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

  public async resolveRefreshToken(encoded: string): Promise<TokenEntity> {
    const payload = await this.authTokenValidation(encoded, false);
    const tokenEntity = await this.getStoredTokenFromRefreshTokenPayload(
      payload,
    );

    if (!tokenEntity) {
      this.logger.log(
        `tokenEntity not found, payload: ${JSON.stringify(payload)}`,
      );
      throw new UnauthorizedException('Illegal Auth token');
    }

    if (
      tokenEntity.isRevoked ||
      Date.now() >= tokenEntity.refreshTokenExpiredAt.getTime() ||
      payload.jti !== tokenEntity.refreshTokenId
    ) {
      this.logger.log(
        `tokenEntity is revoked or expired or invalid, token userId: ${
          tokenEntity.user.id
        }, payload: ${JSON.stringify(payload)}`,
      );
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const user = tokenEntity.user;
    if (!user || !user.isEmailConfirmed || !user.isActive) {
      this.logger.log(
        `user not found or deactivated or not email confirmed, userId: ${payload.sub}`,
      );
      throw new UnauthorizedException('Illegal Auth Token');
    }

    return tokenEntity;
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
        relations: ['user'],
        where: {
          user: { id: user.id },
        },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, userId: ${user.id}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    if (!tokenEntity) {
      tokenEntity = new TokenEntity();
      tokenEntity.user = user;
    }

    tokenEntity.isRevoked = false;
    tokenEntity.refreshTokenExpiredAt = new Date(
      Date.now() + this._refreshTokenTTL,
    );
    tokenEntity.refreshTokenId = crypto.randomUUID({
      disableEntropyCache: true,
    });

    try {
      return await this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(
        `tokenRepository.save failed, token userId: ${tokenEntity.user.id}`,
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
    const tokenEntity = await this.resolveRefreshToken(dto.refresh_token);
    return await this.generateAccessToken(tokenEntity.user, tokenEntity);
  }

  public async createOrGetAuthMailEntity(
    userEntity: UserEntity,
    isCreateForce = false,
  ): Promise<AuthMailEntity> {
    let authMail;
    if (!isCreateForce) {
      try {
        authMail = await this.authMailRepository.findOne({
          relations: ['user'],
          where: {
            user: { id: userEntity.id },
            expiredAt: MoreThan(new Date()),
          },
        });
      } catch (error) {
        this.logger.error(
          `authMailRepository.findOne failed, userId: ${userEntity.id}`,
          error,
        );
        throw new InternalServerErrorException('Something went wrong');
      }

      if (authMail) {
        return authMail;
      }
    }

    authMail = new AuthMailEntity();
    authMail.user = userEntity;
    authMail.from = this.configService.get<string>('mail.from');
    authMail.sendTo = userEntity.email;
    authMail.verificationId = String(
      Math.floor(100000 + Math.random() * 900000),
    );
    authMail.expiredAt = new Date(Date.now() + this._mailTokenTTL);
    authMail.mailSentAt = null;
    authMail.isEmailSent = false;
    authMail.isActive = true;
    authMail.isUpdatable = true;

    if (isCreateForce) {
      authMail.mailSentAt = new Date();
      authMail.isEmailSent = true;
    }

    try {
      return await this.authMailRepository.save(authMail);
    } catch (error) {
      this.logger.error(
        `authMailRepository.save failed, userId: ${authMail.user.id}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }
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

    let tokenEntity;
    try {
      tokenEntity = await this.tokenRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: userId },
          refreshTokenId: refreshTokenId,
        },
      });
    } catch (error) {
      this.logger.error(
        `tokenRepository.findOne failed, refreshTokenId: ${refreshTokenId}, userId; ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Something went wrong');
    }

    return tokenEntity;
  }
}