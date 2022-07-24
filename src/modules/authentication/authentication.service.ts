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
import { AuthMailEntity, TokenEntity } from './domain/entity';
import { MoreThan, Repository } from 'typeorm';
import { RefreshDto } from './domain/dto/refresh.dto';
import { GroupService } from '../profile/services/group.service';
import * as argon2 from 'argon2';
import {
  ChangePasswordDto,
  GetResetPasswordDto,
  PostResetPasswordDto,
} from './domain/dto/password.dto';
import { validate } from 'class-validator';
import { LoginDto } from './domain/dto/login.dto';
import { UserCreateDto } from '../profile/domain/dto/userCreate.dto';
import { SignupDto } from './domain/dto/signup.dto';
import { MailService } from '../mail/mail.service';
import { ResendAuthMailDto } from './domain/dto/verification.dto';
import { AuthMailType } from './domain/entity/authMail.entity';
import { v4 as uuidv4 } from 'uuid';

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
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (dto instanceof Array) {
      this.logger.log(
        `changeUserPassword Data Invalid, username: ${dto.username}`,
      );
      throw new BadRequestException({ message: 'Request Data Invalid' });
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
        `changeUserPassword tokenRepository.findOne failed, userId: ${tokenPayload.sub}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    const user = tokenEntity.user;
    if (!user.isActive) {
      this.logger.log(
        `changeUserPassword failed, user inactivated, username: ${user.username}`,
      );
      throw new ForbiddenException({ message: '' });
    }

    if (user.username !== dto.username) {
      this.logger.warn(
        `requested username doesn't match with user auth token, token user: ${user.username}, dto: ${dto.username}`,
      );
      throw new ForbiddenException({ message: '' });
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.oldPassword);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${user.username}`, err);
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${user.username}`,
      );
      throw new ForbiddenException({ message: 'Password Invalid' });
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

    // tokenEntity.isRevoked = true;
    // try {
    //   return this.tokenRepository.save(tokenEntity);
    // } catch (error) {
    //   this.logger.error(
    //     `tokenRepository.save failed, tokenEntity Id: ${tokenEntity.id}, userId: ${user.id}`,
    //     error,
    //   );
    //   throw new InternalServerErrorException({
    //     message: 'Something went wrong',
    //   });
    // }
  }

  public async userAuthentication(dto: LoginDto, res: Response): Promise<void> {
    if (dto instanceof Array) {
      this.logger.log(
        `userAuthentication Data Invalid, username: ${dto.username}`,
      );
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Request Data Invalid' });
      return;
    }

    const errors = await validate(dto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `userAuthentication data validation failed, username: ${dto.username}, errors: ${errors}`,
      );

      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: `Username Or Password Invalid`, errors });
      return;
    }

    const user = await this.userService.findByName(dto.username);

    if (!user) {
      this.logger.log(`user not found, username: ${dto.username}`);
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'Username Or Password Invalid' });
      return;
    }

    if (!user.isActive) {
      this.logger.log(
        `userAuthentication failed, user inactivated, username: ${dto.username}`,
      );
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'Username Or Password Invalid' });
      return;
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.password);
    } catch (err) {
      this.logger.error(`argon2.hash failed, username: ${dto.username}`, err);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: 'Something went wrong' });
      return;
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${dto.username}`,
      );
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'Username Or Password Invalid' });
      return;
    }

    if (user.isEmailConfirmed) {
      const { refreshToken, tokenEntity } = await this.generateRefreshToken(
        user,
      );
      const accessToken = await this.generateAccessToken(user, tokenEntity);

      res.status(HttpStatus.OK).send({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return;
    }

    const authMailEntity = await this.createOrGetAuthMailEntity(user);
    const authMailToken = await this.generateAuthMailToken(
      user,
      authMailEntity,
    );
    res.status(201).send({ access_token: authMailToken });
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
      throw new UnauthorizedException({ message: '' });
    }

    const authMailToken = await this.authTokenValidation(token, false);
    let authMail;
    try {
      authMail = await this.authMailRepository.findOne({
        where: {
          id: authMailToken.jti,
          mailType: AuthMailType.USER_VERIFICATION,
        },
      });
    } catch (error) {
      this.logger.error(
        `authMailRepository.findOne of resendMailVerification failed, id: ${authMailToken.jti}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    if (!authMail) {
      this.logger.warn(
        `authMail entity of token invalid, authMail id: ${authMailToken.jti}`,
      );
      throw new ForbiddenException({ message: '' });
    }

    if (!dto || !dto.username) {
      throw new BadRequestException({ message: 'Input Data Invalid' });
    }

    const user = authMail.user;
    if (dto.username !== user.username) {
      throw new ForbiddenException({ message: '' });
    }

    if (user.isEmailConfirmed) {
      this.logger.warn(
        `user try again to resend mail verification, userId: ${user.id}`,
      );
      throw new BadRequestException({
        message: 'Resend Mail Verification Invalid',
      });
    }

    const authMailEntity = await this.createOrGetAuthMailEntity(user);

    if (authMailEntity.isEmailSent) {
      this.logger.log(
        `mail verification already send to user, userId: ${user.id}, sendTo: ${authMailEntity.sendTo}`,
      );
      return;
    }

    authMailEntity.isEmailSent = true;
    authMailEntity.mailSentAt = new Date();
    try {
      await this.authMailRepository.save(authMailEntity);
    } catch (error) {
      this.logger.error(
        `authMailRepository.save of resendMailVerification failed, userId: ${user.id}, 
                 authMail Id: ${authMailEntity.id}`,
        error,
      );
    }

    this.mailService.sendCodeConfirmation(
      user.username,
      user.email,
      Number(authMailEntity.verificationId),
    );
  }

  public async sendForgetPasswordMail(email: string): Promise<any> {
    let authMail;
    let userEntity;
    try {
      userEntity = await this.userService.findByEmail(email);
    } catch (err) {
      this.logger.error(`userService.findByEmail failed, email: ${email}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!userEntity) {
      this.logger.debug(
        `forget password failed, email not found, email: ${email}`,
      );
      throw new NotFoundException({ message: 'Email Not Found' });
    }

    if (!userEntity.isEmailConfirmed) {
      this.logger.warn(
        `user try reset password mean while didn't confirmed, 
        userId: ${userEntity.id}, email: ${userEntity.email}`,
      );
      throw new BadRequestException({ message: 'Reset Password Invalid' });
    }

    try {
      authMail = await this.authMailRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: userEntity.id },
          sendTo: email,
          expiredAt: MoreThan(new Date()),
          mailType: AuthMailType.FORGOTTEN_PASSWORD,
        },
      });
    } catch (err) {
      this.logger.error(`authMailRepository.find failed, email: ${email}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (authMail) {
      this.logger.warn(`already sent forget password email, 
      username: ${authMail.user.username}, email: ${email}, date: ${authMail.mailSentAt} `);
      return;
    }

    authMail = new AuthMailEntity();
    authMail.user = userEntity;
    authMail.from = this.configService.get<string>('mail.from');
    authMail.sendTo = userEntity.email;
    authMail.verificationId = uuidv4();
    authMail.expiredAt = new Date(Date.now() + this._mailTokenTTL);
    authMail.isActive = true;
    authMail.isUpdatable = true;
    authMail.mailSentAt = new Date();
    authMail.isEmailSent = true;
    authMail.mailType = AuthMailType.FORGOTTEN_PASSWORD;

    try {
      await this.authMailRepository.save(authMail);
    } catch (error) {
      this.logger.error(
        `authMailRepository.save failed, userId: ${authMail.user.id}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    const absoluteUrl =
      'https://' +
      this.configService.get<string>('http.domain') +
      '/api/auth/mail/password/reset/' +
      userEntity.id +
      '/' +
      authMail.verificationId;

    this.mailService.sendForgetPassword(
      userEntity.username,
      userEntity.email,
      absoluteUrl,
    );
  }

  public async postUserResetPasswordHandler(
    userId: string,
    resetId: string,
    resetPasswordDto: PostResetPasswordDto,
  ): Promise<any> {
    let authMail;
    try {
      authMail = await this.authMailRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: userId },
          verificationId: resetId,
          expiredAt: MoreThan(new Date()),
          mailType: AuthMailType.FORGOTTEN_PASSWORD,
        },
      });
    } catch (err) {
      this.logger.error(
        `authMailRepository.findOne failed, userId: ${userId}`,
        err,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!authMail) {
      this.logger.debug(
        `reset password failed, auth mail entity not found, userId: ${userId}, resetId: ${resetId}`,
      );
      throw new NotFoundException({ message: 'User Not Found' });
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(resetPasswordDto.newPassword);
    } catch (err) {
      this.logger.error(
        `argon2.hash failed, username: ${authMail.user.username}`,
        err,
      );
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    authMail.user.password = hashPassword;
    await this.userService.updateEntity(authMail.user);
  }

  public async getUserResetPasswordReq(
    userId: string,
    resetId: string,
  ): Promise<GetResetPasswordDto> {
    let authMail;
    try {
      authMail = await this.authMailRepository.findOne({
        relations: ['user'],
        where: {
          user: { id: userId },
          verificationId: resetId,
          expiredAt: MoreThan(new Date()),
          mailType: AuthMailType.FORGOTTEN_PASSWORD,
        },
      });
    } catch (err) {
      this.logger.error(
        `authMailRepository.findOne failed, userId: ${userId}`,
        err,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!authMail) {
      this.logger.debug(
        `reset password failed, auth mail entity not found, userId: ${userId}, resetId: ${resetId}`,
      );
      throw new NotFoundException({ message: 'User Not Found' });
    }

    const resetPasswordDto = new GetResetPasswordDto();
    resetPasswordDto.id = authMail.user.id;
    resetPasswordDto.username = authMail.user.username;
    resetPasswordDto.resetPasswordId = authMail.verificationId;
    return resetPasswordDto;
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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    if (!tokenEntity) {
      this.logger.error(
        `user token for revokeAuthToken not found, userId: ${userId}`,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    tokenEntity.isRevoked = true;
    try {
      return this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(`user token not found, userId: ${userId}`, error);
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }
  }

  public async authMailCodeConfirmation(
    authMailToken: TokenPayload,
    verifyCode: string,
  ): Promise<AuthMailEntity> {
    if (!authMailToken.jti || authMailToken.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException({ message: '' });
    }

    let authMail;
    try {
      authMail = await this.authMailRepository.findOne({
        where: {
          id: authMailToken.jti,
          mailType: AuthMailType.USER_VERIFICATION,
        },
      });
    } catch (error) {
      this.logger.error(
        `authMailRepository.findOne failed, id: ${authMailToken.jti}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    if (authMail.verificationId !== verifyCode) {
      this.logger.warn(
        `verify code invalid, userId: ${authMailToken.sub}, code: ${verifyCode}`,
      );
      throw new UnauthorizedException({ message: '' });
    }

    if (!authMail.user.isActive) {
      this.logger.warn(`user inactivated, userId: ${authMailToken.sub}`);
      throw new UnauthorizedException({ message: '' });
    }

    let memberGroup;
    try {
      memberGroup = await this.groupService.findByName('MEMBER');
    } catch (error) {
      this.logger.error(
        `groupService.findByName for MEMBER group failed, userId: ${authMail.user.id}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }
  }

  public async accessTokenValidation(
    payload: TokenPayload,
  ): Promise<UserEntity | HttpStatus> {
    if (!payload.sub) {
      this.logger.log(`payload.sub invalid, payload: ${payload}`);
      throw new UnauthorizedException({ message: 'Illegal Auth Token' });
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

      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    if (payload.exp * 1000 <= Date.now()) {
      return HttpStatus.EXPECTATION_FAILED;
    }

    if (
      tokenEntity &&
      !tokenEntity.isRevoked &&
      tokenEntity.accessTokenId === payload.jti &&
      tokenEntity.user.isEmailConfirmed &&
      tokenEntity.user.isActive
    ) {
      return tokenEntity.user;
    }

    return HttpStatus.UNAUTHORIZED;
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
      this.logger.error(
        `authTokenValidation jwt.verifyAsync failed, token: ${token}`,
        error,
      );
      // if (e instanceof TokenExpiredError) {
      //   throw new UnauthorizedException('Illegal Auth Token');
      // } else {
      throw new UnauthorizedException({ message: '' });
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
      throw new UnauthorizedException({ message: '' });
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
      throw new UnauthorizedException({ message: '' });
    }

    const user = tokenEntity.user;
    if (!user || !user.isEmailConfirmed || !user.isActive) {
      this.logger.log(
        `user not found or deactivated or not email confirmed, userId: ${payload.sub}`,
      );
      throw new UnauthorizedException({ message: '' });
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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
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
      jti: tokenEntity.accessTokenId,
    };
    const option = {
      algorithm: 'ES512' as Algorithm,
      privateKey: this._privateKey,
    };
    try {
      return await this.jwt.signAsync(payload, option);
    } catch (error) {
      this.logger.error(
        `accessToken jwt.signAsync failed, payload: ${payload}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
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

    let refreshToken;
    try {
      refreshToken = await this.jwt.signAsync(payload, option);
    } catch (error) {
      this.logger.error(
        `refreshToken jwt.signAsync failed, payload: ${payload}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }
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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
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
    tokenEntity.accessTokenId = crypto.randomUUID({
      disableEntropyCache: true,
    });

    try {
      return await this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(
        `tokenRepository.save of createTokenEntity failed, token userId: ${tokenEntity.user.id}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }
  }

  public async createAccessTokenFromRefreshToken(
    dto: RefreshDto,
  ): Promise<string> {
    let tokenEntity = await this.resolveRefreshToken(dto.refresh_token);
    tokenEntity.accessTokenId = crypto.randomUUID({
      disableEntropyCache: true,
    });

    try {
      tokenEntity = await this.tokenRepository.save(tokenEntity);
    } catch (error) {
      this.logger.error(
        `tokenRepository.save for createAccessTokenFromRefreshToken failed, token userId: ${tokenEntity.user.id}`,
        error,
      );
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

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
            mailType: AuthMailType.USER_VERIFICATION,
          },
        });
      } catch (error) {
        this.logger.error(
          `authMailRepository.findOne failed, userId: ${userEntity.id}`,
          error,
        );
        throw new InternalServerErrorException({
          message: 'Something went wrong',
        });
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
    authMail.mailType = AuthMailType.USER_VERIFICATION;

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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }
  }

  private async getStoredTokenFromRefreshTokenPayload(
    payload: TokenPayload,
  ): Promise<TokenEntity | null> {
    const refreshTokenId = payload.jti;
    const userId = payload.sub;
    if (!refreshTokenId || !userId) {
      this.logger.log(`payload invalid, payload: ${payload}`);
      throw new UnauthorizedException({ message: '' });
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
      throw new InternalServerErrorException({
        message: 'Something went wrong',
      });
    }

    return tokenEntity;
  }
}
