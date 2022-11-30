import * as crypto from "crypto";
import { CACHE_MANAGER, HttpException, HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Algorithm } from "jsonwebtoken";
import { JwtService } from "@nestjs/jwt";
import * as fs from "fs";
import { Request, Response } from "express";
import { UserService } from "../profile/services/user.service";
import { UserEntity } from "../profile/domain/entity";
import { ConfigService } from "@nestjs/config";
import { join } from "path";
import { InjectEntityManager } from "@nestjs/typeorm";
import { AuthMailEntity, AuthTokenEntity } from "./domain/entity";
import { EntityManager, MoreThan } from "typeorm";
import { UserGroupService } from "../profile/services/userGroup.service";
import * as argon2 from "argon2";
import { ChangePasswordDto, GetResetPasswordDto, PostResetPasswordDto } from "./domain/dto/password.dto";
import { LoginDto } from "./domain/dto/login.dto";
import { UserCreateDto } from "../profile/domain/dto";
import { SignupDto } from "./domain/dto/signup.dto";
import { MailService } from "../mail/mail.service";
import { ResendAuthMailDto } from "./domain/dto/verification.dto";
import { AuthMailType } from "./domain/entity/authMail.entity";
import { v4 as uuidv4 } from "uuid";
import { Cache } from "cache-manager";

export interface TokenPayload {
  iss: string;
  aud: string;
  exp: number;
  nbf: number;
  jti: string;
  sub: string;
  data: object;
}

type AuthAccessToken = {
  accessTokenId: string,
  accessToken: string,
  authTokenEntity: AuthTokenEntity
}

type AuthRefreshToken = {
  refreshToken: string,
  authTokenEntity: AuthTokenEntity
}

type AuthMailToken = {
  mailToken: string,
  authMailEntity: AuthMailEntity,
  latestMailResendTimestamp: number
}

@Injectable()
export class AuthenticationService {
  private readonly _logger = new Logger(AuthenticationService.name);
  private readonly _privateKey;
  private readonly _publicKey;
  private readonly _refreshTokenTTL;
  private readonly _accessTokenTTL;
  private readonly _mailTokenTTL;
  private readonly _domain;
  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    @Inject(CACHE_MANAGER)
    private readonly _cacheManager: Cache,
    private readonly _userService: UserService,
    private readonly _groupService: UserGroupService,
    private readonly _configService: ConfigService,
    private readonly _jwt: JwtService,
    private readonly _mailService: MailService,
  ) {
    this._privateKey = fs.readFileSync(
      join(
        process.cwd(),
        '/dist/resources/',
        this._configService.get<string>('app.privateKey'),
      ),
    );
    this._publicKey = fs.readFileSync(
      join(
        process.cwd(),
        '/dist/resources/',
        this._configService.get<string>('app.publicKey'),
      ),
    );

    this._accessTokenTTL = this._configService.get<number>('app.accessTokenTTL');
    this._refreshTokenTTL = this._configService.get<number>('app.refreshTokenTTL');
    this._mailTokenTTL = this._configService.get<number>('app.mailTokenTTL');
    this._domain = this._configService.get<string>('http.domain');
  }

  get publicKey() {
    return this._publicKey;
  }

  get domain() {
    return this._domain
  }

  public async changeUserPassword(
    user: UserEntity,
    dto: ChangePasswordDto,
  ): Promise<void> {
    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.oldPassword);
    } catch (err) {
      this._logger.error(`argon2.hash failed, email: ${user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!isPassVerify) {
      this._logger.log(`user password verification failed, email: ${user.email}`);
      throw new HttpException({
        statusCode: '403',
        message: 'Password Invalid',
        error: 'FORBIDDEN'
      }, HttpStatus.FORBIDDEN)
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(dto.newPassword);
    } catch (err) {
      this._logger.error(`argon2.hash failed, email: ${user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    user.password = hashPassword;
    await this._userService.updateEntity(user);
    try {
      await this._cacheManager.set(`USER.EMAIL:${user.email}`, user, {ttl: this._refreshTokenTTL / 1000});
      await this._cacheManager.del(`AUTH_ACCESS_TOKEN.USER_ID:${user.id}`);
      await this._cacheManager.del(`AUTH_REFRESH_TOKEN.USER_ID:${user.id}`);
    } catch (err) {
      this._logger.error(`changeUserPassword cache actions failed, AUTH_ACCESS_TOKEN.USER_ID:${user.id}, USER.EMAIL:${user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async userAuthentication(dto: LoginDto, res: Response): Promise<void> {
    let user
    try {
      user = await this._cacheManager.get<UserEntity>(`USER.EMAIL:${dto.email}`);
    } catch (err) {
      this._logger.error(`userAuthentication cache get failed, USER.EMAIL:${dto.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if(!user) {
      user = await this._userService.findByEmail(dto.email);
      if (!user) {
        this._logger.log(`user not found, email: ${dto.email}`);
        res
          .status(HttpStatus.NOT_FOUND)
          .send({
            statusCode: '404',
            message: 'Email Or Password Invalid',
            error: 'Not Found'
          });
        return;
      }

      try {
        await this._cacheManager.set(`USER.EMAIL:${dto.email}`, user, {ttl: this._refreshTokenTTL / 1000});
      } catch (err) {
        this._logger.error(`userAuthentication cache set failed, USER.EMAIL:${dto.email}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    if (!user.isActive) {
      this._logger.log(
        `userAuthentication failed, user inactivated, email: ${dto.email}`,
      );
      res
        .status(HttpStatus.NOT_FOUND)
        .send({
          statusCode: '404',
          message: 'Email Or Password Invalid' ,
          error: 'Not Found'
        });
      return;
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, dto.password);
    } catch (err) {
      this._logger.error(`argon2.hash failed, email: ${dto.email}`, err);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        });
      return;
    }

    if (!isPassVerify) {
      this._logger.log(`user password verification failed, email: ${dto.email}`);
      res
        .status(HttpStatus.NOT_FOUND)
        .send({
          statusCode: '404',
          message: 'Email Or Password Invalid' ,
          error: 'Not Found'
        });
      return;
    }

    if (user.isEmailConfirmed) {
      let authTokenEntity = await this.getAuthTokenEntity(user);
      if(!authTokenEntity) {
        authTokenEntity = await this.createAuthTokenEntity(user);
      }

      const refreshToken = await this.generateRefreshToken(authTokenEntity);
      const accessToken = await this.generateAccessToken(authTokenEntity);

      res.status(HttpStatus.OK).send({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return;
    }

    let authMailEntity = await this.getAuthMailEntity(user);
    if(!authMailEntity) {
      authMailEntity = await this.createAuthMailEntity(user, AuthMailType.USER_VERIFICATION);
    }
    const authMailToken = await this.generateAuthMailToken(authMailEntity);
    res.status(201).send({ access_token: authMailToken });
  }

  public async userSignUp(dto: SignupDto): Promise<string> {
    const userDto = new UserCreateDto();
    userDto.password = dto.password;
    userDto.email = dto.email;
    userDto.userGroup = 'GHOST';
    const user = await this._userService.create(userDto);
    const authMailEntity = await this.createAuthMailEntity(user, AuthMailType.USER_VERIFICATION);
    this._mailService.sendCodeConfirmation(
      userDto.email,
      Number(authMailEntity.verificationId),
    );
    try {
      await this._cacheManager.set(`USER.EMAIL:${dto.email}`, user, {ttl: this._mailTokenTTL / 1000});
    } catch (err) {
      this._logger.error(`userSignUp cache set failed, USER.EMAIL:${dto.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return await this.generateAuthMailToken(authMailEntity);
  }

  public async authMailCodeConfirmation(
    mailToken: TokenPayload,
    verifyCode: string,
  ): Promise<AuthMailEntity> {
    if (!mailToken.jti || mailToken.exp * 1000 <= Date.now()) {
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let authMailToken;
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`);
    } catch (err) {
      this._logger.error(`authMailCodeConfirmation cache get failed, AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!authMailToken) {
      this._logger.warn(
        `authMailToken not found, mailToken: ${JSON.stringify(mailToken)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (authMailToken.authMailEntity.verificationId !== verifyCode) {
      this._logger.warn(
        `verify code invalid, userId: ${mailToken.sub}, code: ${verifyCode}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (!authMailToken.authMailEntity.user.isActive) {
      this._logger.warn(`user inactivated, userId: ${mailToken.sub}`);
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let memberGroup;
    try {
      memberGroup = await this._groupService.findByName('MEMBER');
    } catch (error) {
      this._logger.error(
        `groupService.findByName for MEMBER userGroup failed, userId: ${authMailToken.authMailEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      authMailToken.authMailEntity.user.isEmailConfirmed = true;
      authMailToken.authMailEntity.user.userGroup = memberGroup;
      await this._entityManager.getRepository(AuthMailEntity).save(authMailToken.authMailEntity);
    } catch (error) {
      this._logger.error(
        `mailVerificationRepository.save failed, userId: ${authMailToken.authMailEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      await this._cacheManager.set(`USER.EMAIL:${authMailToken.authMailEntity.user.email}`, authMailToken.authMailEntity.user, {ttl: this._refreshTokenTTL / 1000});
      await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailToken.authMailEntity.user.id}`);
      await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`);
    } catch (err) {
      this._logger.error(`authMailCodeConfirmation cache actions failed, AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}, USER.EMAIL:${authMailToken.authMailEntity.user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return authMailToken.authMailEntity;
  }

  public async resendMailVerification(
    dto: ResendAuthMailDto,
    token: string,
  ): Promise<void> {
    if (!token) {
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let authMailEntity;
    const mailToken = await this.authTokenValidation(token, false);
    let authMailToken
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`);
    } catch (err) {
      this._logger.error(`resendMailVerification cache get failed, key: AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!authMailToken) {
      this._logger.warn(
        `authMailToken not found, authMail id: ${mailToken.jti}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'UNAUTHORIZED'
      }, HttpStatus.UNAUTHORIZED);
    }
    authMailEntity = authMailToken.authMailEntity;
    const user = authMailEntity.user;
    if (dto.email !== user.email) {
      throw new HttpException({
        statusCode: '403',
        message: 'Forbidden',
        error: 'Forbidden'
      }, HttpStatus.FORBIDDEN);
    }

    if (user.isEmailConfirmed) {
      this._logger.warn(
        `user try again to resend mail verification, userId: ${user.id}`,
      );
      throw new HttpException({
        statusCode: '400',
        message:  'Resend Mail Verification Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    // one resend mail rate limit in 60 seconds
    if(authMailToken.latestMailResendTimestamp &&
      Math.abs(authMailToken.latestMailResendTimestamp - Date.now()) / 1000 < 60) {
      throw new HttpException({
        statusCode: '400',
        message: 'Resend Mail Verification Limited',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    authMailEntity.expiredAt = new Date(authMailEntity.expiredAt);
    try {
      await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.ID:${authMailEntity.id}`,
        { mailToken, authMailEntity, latestMailResendTimestamp: Date.now() },
        { ttl: Math.round((authMailEntity.expiredAt.getTime() - Date.now()) / 1000) });
    } catch (err) {
      this._logger.error(`resendMailVerification cache set failed, AUTH_MAIL_USER_VERIFICATION.ID:${authMailEntity.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this._mailService.sendCodeConfirmation(
      user.email,
      Number(authMailEntity.verificationId),
    );
  }

  public async sendForgetPasswordMail(req: Request, email: string): Promise<any> {
    let authMailEntity;
    let userEntity;
    try {
      userEntity = await this._cacheManager.get<UserEntity>(`USER.EMAIL:${email}`);
    } catch (err) {
      this._logger.error(`sendForgetPasswordMail cache get failed, USER.EMAIL:${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!userEntity) {
      try {
        userEntity = await this._userService.findByEmail(email);
      } catch (err) {
        this._logger.error(`userService.findByEmail failed, email: ${email}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!userEntity) {
        this._logger.debug(
          `forget password failed, email not found, email: ${email}`,
        );
        throw new HttpException({
          statusCode: '404',
          message: 'Email Not Found',
          error: 'Not Found'
        }, HttpStatus.NOT_FOUND);
      }
    }

    if (!userEntity.isEmailConfirmed) {
      this._logger.warn(
        `user try reset password mean while didn't confirmed, 
        userId: ${userEntity.id}, email: ${userEntity.email}`,
      );
      throw new HttpException({
        statusCode: '400',
        message: 'Reset Password Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    let authMailToken
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userEntity.id}`)
    } catch (err) {
      this._logger.error(`sendForgetPasswordMail cache get failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userEntity.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if(!authMailToken) {
      try {
        authMailEntity = await this._entityManager.getRepository(AuthMailEntity).findOne({
          relations: ['user'],
          where: {
            user: { id: userEntity.id },
            sendTo: email,
            expiredAt: MoreThan(new Date()),
            mailType: AuthMailType.FORGOTTEN_PASSWORD,
          },
        });
      } catch (err) {
        this._logger.error(`authMailRepository.find failed, email: ${email}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } else {
      authMailEntity = authMailToken.authMailEntity;
    }

    if (authMailEntity) {
      this._logger.warn(`already sent forget password email, 
      email: ${email}, date: ${authMailEntity.mailSentAt} `);
      throw new HttpException({
        statusCode: '400',
        message: 'Already Sent Forget Password Email',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    authMailEntity = await this.createAuthMailEntity(userEntity, AuthMailType.FORGOTTEN_PASSWORD)
    const absoluteUrl = `${req.protocol}://${req.get('host')}/forget-password/change-password?`
      + `user-id=${userEntity.id}&reset-id=${authMailEntity.verificationId}`;

    try {
      await this._cacheManager.set(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`,
        { mailToken: null, authMailEntity, latestMailResendTimestamp: null },
        { ttl: this._mailTokenTTL / 1000 });
    } catch (err) {
      this._logger.error(`sendForgetPasswordMail cache set failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this._mailService.sendForgetPassword(
      userEntity.email,
      absoluteUrl,
    );
    try {
      await this._cacheManager.set(`USER.EMAIL:${email}`, userEntity, {ttl: this._mailTokenTTL / 1000});
    } catch (err) {
      this._logger.error(`sendForgetPasswordMail cache set failed, USER.EMAIL:${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async postUserResetPasswordHandler(
    userId: string,
    resetId: string,
    resetPasswordDto: PostResetPasswordDto,
  ): Promise<any> {
    let authMailToken
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
    } catch (err) {
      this._logger.error(`postUserResetPasswordHandler cache get failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!authMailToken) {
      this._logger.debug(
        `reset password failed, auth mail entity not found, userId: ${userId}, resetId: ${resetId}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: 'Request Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(resetPasswordDto.newPassword);
    } catch (err) {
      this._logger.error(
        `argon2.hash failed, email: ${authMailToken.authMailEntity.user.email}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    authMailToken.authMailEntity.user.password = hashPassword;
    await this._userService.updateEntity(authMailToken.authMailEntity.user);

    try {
      await this._cacheManager.set(`USER.EMAIL:${authMailToken.authMailEntity.user.email}`, authMailToken.authMailEntity.user, {ttl: this._refreshTokenTTL / 1000});
      await this._cacheManager.del(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
    } catch (err) {
      this._logger.error(`postUserResetPasswordHandler cache actions failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId} USER.EMAIL:${authMailToken.authMailEntity.user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getUserResetPasswordReq(
    userId: string,
    resetId: string,
  ): Promise<GetResetPasswordDto> {
    let authMailToken
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
    } catch (err) {
      this._logger.error(`getUserResetPasswordReq cache get failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if (!authMailToken) {
      this._logger.debug(
        `reset password failed, auth mail entity not found, userId: ${userId}, resetId: ${resetId}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: 'Request Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    const resetPasswordDto = new GetResetPasswordDto();
    resetPasswordDto.id = authMailToken.authMailEntity.user.id;
    resetPasswordDto.email = authMailToken.authMailEntity.user.email;
    resetPasswordDto.resetPasswordId = authMailToken.authMailEntity.verificationId;
    return resetPasswordDto;
  }

  public async revokeAuthToken(userId: string): Promise<AuthTokenEntity> {
    let authTokenEntity: AuthTokenEntity;
    let authRefreshToken;
    try {
      authRefreshToken = await this._cacheManager.get<AuthRefreshToken>(`AUTH_REFRESH_TOKEN.USER_ID:${userId}`);
    } catch (err) {
      this._logger.error(`revokeAuthToken cache get failed, AUTH_REFRESH_TOKEN.USER_ID:${userId}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if(!authRefreshToken) {
      let authAccessToken
      try {
        authAccessToken = await this._cacheManager.get<AuthAccessToken>(`AUTH_ACCESS_TOKEN.USER_ID:${userId}`);
      } catch (err) {
        this._logger.error(`revokeAuthToken cache get failed, AUTH_ACCESS_TOKEN.USER_ID:${userId}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!authAccessToken) {
        try {
          authTokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
            relations: ['user'],
            where: {
              user: { id: userId },
            },
          });
        } catch (error) {
          this._logger.error(
            `tokenRepository.findOne failed, userId: ${userId}`,
            error,
          );
          throw new HttpException({
            statusCode: '500',
            message: 'Something Went Wrong',
            error: 'Internal Server Error'
          }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        authTokenEntity = authAccessToken.authTokenEntity;
      }
    } else {
      authTokenEntity = authRefreshToken.authTokenEntity;
    }

    if (!authTokenEntity) {
      this._logger.error(
        `user authToken for revokeAuthToken not found, userId: ${userId}`,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    authTokenEntity.isRevoked = true;
    try {
      await this._entityManager.getRepository(AuthTokenEntity).save(authTokenEntity);
    } catch (error) {
      this._logger.error(`user authToken not found, userId: ${userId}`, error);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      await this._cacheManager.del(`USER.EMAIL:${authTokenEntity.user.email}`);
      await this._cacheManager.del(`AUTH_ACCESS_TOKEN.USER_ID:${userId}`);
      await this._cacheManager.del(`AUTH_REFRESH_TOKEN.USER_ID:${userId}`);
    } catch (err) {
      this._logger.error(`revokeAuthToken cache actions failed, USER.EMAIL:${authTokenEntity.user.email}, AUTH_ACCESS_TOKEN.USER_ID:${userId}`, err);
    }
    return authTokenEntity;
  }

  public async accessTokenValidation(
    payload: TokenPayload,
  ): Promise<UserEntity | HttpException> {
    if (!payload.sub || !payload.jti) {
      this._logger.warn(`payload.sub or payload.jti invalid, payload: ${payload}`);
      return new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let authAccessToken
    try {
      authAccessToken = await this._cacheManager.get<AuthAccessToken>(`AUTH_ACCESS_TOKEN.USER_ID:${payload.sub}`);
    } catch (err) {
      this._logger.error(`accessTokenValidation cache get failed, AUTH_ACCESS_TOKEN.USER_ID:${payload.sub}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if(!authAccessToken) {
      return new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (payload.exp * 1000 <= Date.now()) {
      return new HttpException({
        statusCode: '417',
        message: 'Access Token Expired',
        error: 'Expectation Failed'
      }, HttpStatus.EXPECTATION_FAILED);
    }

    if (
      !authAccessToken.authTokenEntity.isRevoked &&
      authAccessToken.authTokenEntity.user.isEmailConfirmed &&
      authAccessToken.accessTokenId === payload.jti &&
      authAccessToken.authTokenEntity.user.isActive
    ) {
      return UserEntity.from(authAccessToken.authTokenEntity.user);
    }

    return new HttpException({
      statusCode: '401',
      message: 'Unauthorized',
      error: 'Unauthorized'
    }, HttpStatus.UNAUTHORIZED);
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
      return await this._jwt.verifyAsync(token, option);
    } catch (error) {
      this._logger.error(
        `authTokenValidation jwt.verifyAsync failed, auth token: ${token}`,
        error,
      );

      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }
  }

  public async resolveRefreshToken(encoded: string): Promise<AuthTokenEntity> {
    const payload = await this.authTokenValidation(encoded, false);
    if (!payload.jti || !payload.sub) {
      this._logger.warn(`refresh token payload invalid, payload: ${payload}`);
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let authRefreshToken;
    try {
      authRefreshToken = await this._cacheManager.get<AuthRefreshToken>(`AUTH_REFRESH_TOKEN.USER_ID:${payload.sub}`);
    } catch (err) {
      this._logger.error(`resolveRefreshToken cache get failed, AUTH_REFRESH_TOKEN.USER_ID:${payload.sub}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!authRefreshToken) {
      this._logger.log(
        `authTokenEntity not found, payload: ${JSON.stringify(payload)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let refreshTokenExpiredAt;
    if(typeof authRefreshToken.authTokenEntity.refreshTokenExpiredAt === 'string') {
      refreshTokenExpiredAt = new Date(authRefreshToken.authTokenEntity.refreshTokenExpiredAt);
    } else {
      refreshTokenExpiredAt = authRefreshToken.authTokenEntity.refreshTokenExpiredAt;
    }

    if (
      authRefreshToken.authTokenEntity.isRevoked ||
      Date.now() >= refreshTokenExpiredAt.getTime() ||
      payload.jti !== authRefreshToken.authTokenEntity.id
    ) {
      this._logger.log(
        `authTokenEntity is revoked or expired or invalid, authToken userId: ${
          authRefreshToken.authTokenEntity.user.id
        }, payload: ${JSON.stringify(payload)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    const user = authRefreshToken.authTokenEntity.user;
    if (!user || !user.isEmailConfirmed || !user.isActive) {
      this._logger.log(
        `user not found or deactivated or not email confirmed, userId: ${payload.sub}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    return authRefreshToken.authTokenEntity;
  }

  public async generateAuthMailToken(authMailEntity: AuthMailEntity): Promise<string> {
    let mailToken;
    let authMailToken;
    if (authMailEntity.mailType === AuthMailType.USER_VERIFICATION) {
      try {
        authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailEntity.user.id}`);
      } catch (err) {
        this._logger.error(`generateAuthMailToken cache get failed, AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailEntity.user.id}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

    } else if(authMailEntity.mailType === AuthMailType.FORGOTTEN_PASSWORD) {
      try {
        authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`);
      } catch (err) {
        this._logger.error(`generateAuthMailToken cache get failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    if(!authMailToken) {
      let expiredAt;
      if (typeof authMailEntity.expiredAt === 'string') {
        expiredAt = new Date(authMailEntity.expiredAt);
      } else {
        expiredAt = authMailEntity.expiredAt;
      }

      const payload = {
        iss: `https://${this._domain}`,
        sub: authMailEntity.user.id,
        aud: `https://${this._domain}`,
        exp: Math.floor(expiredAt.getTime() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        jti: authMailEntity.id,
      };
      const option = {
        algorithm: 'ES512' as Algorithm,
        privateKey: this._privateKey,
      };
      try {
        mailToken = await this._jwt.signAsync(payload, option);
      } catch (error) {
        this._logger.error(`jwt.signAsync failed, payload: ${payload}`, error);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (authMailEntity.mailType === AuthMailType.USER_VERIFICATION) {
        try {
          await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.ID:${authMailEntity.id}`,
            { mailToken, authMailEntity, latestMailResendTimestamp: null },
            { ttl: this._mailTokenTTL / 1000 });
          await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailEntity.user.id}`,
            { mailToken, authMailEntity, latestMailResendTimestamp: null },
            { ttl: this._mailTokenTTL / 1000 });
        } catch (err) {
          this._logger.error(`generateAuthMailToken cache set failed, AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailEntity.user.id}, AUTH_MAIL_USER_VERIFICATION.ID:${authMailEntity.id}`, err);
          throw new HttpException({
            statusCode: '500',
            message: 'Something Went Wrong',
            error: 'Internal Server Error'
          }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else if (authMailEntity.mailType === AuthMailType.FORGOTTEN_PASSWORD) {
        try {
          await this._cacheManager.set(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`,
            { mailToken, authMailEntity, latestMailResendTimestamp: null },
            { ttl: this._mailTokenTTL / 1000 });
        } catch (err) {
          this._logger.error(`generateAuthMailToken cache set failed, AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${authMailEntity.user.id}`, err);
          throw new HttpException({
            statusCode: '500',
            message: 'Something Went Wrong',
            error: 'Internal Server Error'
          }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }
      return mailToken;
    } else {
      return authMailToken.mailToken;
    }
  }

  public async generateAccessToken(authTokenEntity: AuthTokenEntity): Promise<string> {
    let authAccessToken
    try {
      authAccessToken = await this._cacheManager.get<AuthAccessToken>(`AUTH_ACCESS_TOKEN.USER_ID:${authTokenEntity.user.id}`);
    } catch (err) {
      this._logger.error(`generateAccessToken cache get failed, AUTH_ACCESS_TOKEN.USER_ID:${authTokenEntity.user.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if(!authAccessToken) {
      const accessTokenId = crypto.randomUUID({
        disableEntropyCache: true,
      });

      const payload = {
        iss: `https://${this._domain}`,
        sub: authTokenEntity.user.id,
        aud: `https://${this._domain}`,
        exp: Math.floor(Date.now() + this._accessTokenTTL) / 1000,
        nbf: Math.floor(Date.now() / 1000),
        jti: accessTokenId,
      };
      const option = {
        algorithm: 'ES512' as Algorithm,
        privateKey: this._privateKey,
      };
      let accessToken;
      try {
        accessToken = await this._jwt.signAsync(payload, option);
      } catch (error) {
        this._logger.error(
          `accessToken jwt.signAsync failed, payload: ${payload}`,
          error,
        );
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      try {
        await this._cacheManager.set(
          `AUTH_ACCESS_TOKEN.USER_ID:${authTokenEntity.user.id}`,
          { accessTokenId, accessToken, authTokenEntity },
          { ttl: this._accessTokenTTL / 1000 }
        );
      } catch (err) {
        this._logger.error(`generateAccessToken cache set failed, AUTH_ACCESS_TOKEN.USER_ID:${authTokenEntity.user.id}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return accessToken;
    } else {
      return authAccessToken.accessToken;
    }
  }

  public async generateRefreshToken(authTokenEntity: AuthTokenEntity): Promise<string> {
    let refreshToken;
    let authRefreshToken;
    try {
      authRefreshToken = await this._cacheManager.get<AuthRefreshToken>(`AUTH_REFRESH_TOKEN.USER_ID:${authTokenEntity.user.id}`);
    } catch (err) {
      this._logger.error(`generateRefreshToken cache get failed, AUTH_REFRESH_TOKEN.USER_ID:${authTokenEntity.user.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if(!authRefreshToken) {
      let refreshTokenExpiredAt;
      if (typeof authTokenEntity.refreshTokenExpiredAt === 'string') {
        refreshTokenExpiredAt = new Date(authTokenEntity.refreshTokenExpiredAt);
      } else {
        refreshTokenExpiredAt = authTokenEntity.refreshTokenExpiredAt;
      }

      const payload = {
        iss: `https://${this._domain}`,
        sub: authTokenEntity.user.id,
        aud: `https://${this._domain}`,
        exp: Math.floor(refreshTokenExpiredAt.getTime() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        jti: authTokenEntity.id,
      };

      const option = {
        algorithm: 'ES512' as Algorithm,
        privateKey: this._privateKey,
      };

      try {
        refreshToken = await this._jwt.signAsync(payload, option);
      } catch (error) {
        this._logger.error(
          `refreshToken jwt.signAsync failed, payload: ${payload}`,
          error,
        );
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      try {
        await this._cacheManager.set(`AUTH_REFRESH_TOKEN.USER_ID:${authTokenEntity.user.id}`,
          { refreshToken, authTokenEntity },
          { ttl: this._refreshTokenTTL / 1000 });
      } catch (err) {
        this._logger.error(`generateRefreshToken cache set failed, AUTH_REFRESH_TOKEN.USER_ID:${authTokenEntity.user.id}`, err);
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return refreshToken;
    } else {
      return authRefreshToken.refreshToken;
    }
  }

  public async getAuthTokenEntity(user: UserEntity): Promise<AuthTokenEntity> {
    let authTokenEntity: AuthTokenEntity;
    let authRefreshToken
    try {
      authRefreshToken = await this._cacheManager.get<AuthRefreshToken>(`AUTH_REFRESH_TOKEN.USER_ID:${user.id}`);
    } catch (err) {
      this._logger.error(`getAuthTokenEntity cache get failed, AUTH_REFRESH_TOKEN.USER_ID:${user.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if(!authRefreshToken) {
      try {
        authTokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
          relations: {
            user: true
          },
          join: {
            alias: "authMail",
            innerJoinAndSelect: {
              user: "authMail.user",
              userGroup: "user.userGroup",
              role: "userGroup.role"
            }
          },
          loadEagerRelations: true,
          where: {
            user: { id: user.id },
            refreshTokenExpiredAt: MoreThan(new Date()),
            isRevoked: false
          },
        });
      } catch (error) {
        this._logger.error(
          `_authTokenRepository.findOne failed, userId: ${user.id}`,
          error,
        );
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    return authTokenEntity;
  }

  public async createAuthTokenEntity(user: UserEntity): Promise<AuthTokenEntity> {
    const authTokenEntity = new AuthTokenEntity();
    authTokenEntity.user = user;
    authTokenEntity.isRevoked = false;
    authTokenEntity.refreshTokenExpiredAt = new Date(Date.now() + this._refreshTokenTTL);

    try {
      await this._entityManager.getRepository(AuthTokenEntity).insert(authTokenEntity);
    } catch (error) {
      this._logger.error(
        `authTokenRepository.save of createTokenEntity failed, token userId: ${authTokenEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return authTokenEntity;
  }

  public async createAuthMailEntity(userEntity: UserEntity, mailType: AuthMailType): Promise<AuthMailEntity> {
    const authMailEntity = new AuthMailEntity();
    authMailEntity.user = userEntity;
    authMailEntity.from = this._configService.get<string>('mail.from');
    authMailEntity.sendTo = userEntity.email;
    authMailEntity.expiredAt = new Date(Date.now() + this._mailTokenTTL);
    authMailEntity.isActive = true;
    authMailEntity.isUpdatable = true;

    if(mailType === AuthMailType.USER_VERIFICATION) {
      authMailEntity.verificationId = String(Math.floor(100000 + Math.random() * 900000));
      authMailEntity.mailType = AuthMailType.USER_VERIFICATION;

    } else if(mailType === AuthMailType.FORGOTTEN_PASSWORD) {
      authMailEntity.verificationId = uuidv4();
      authMailEntity.mailType = AuthMailType.FORGOTTEN_PASSWORD;
    }

    try {
      await this._entityManager.getRepository(AuthMailEntity).insert(authMailEntity);
    } catch (error) {
      this._logger.error(
        `authMailRepository.save failed, userId: ${authMailEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return authMailEntity;
  }

  public async getAuthMailEntity(userEntity: UserEntity): Promise<AuthMailEntity> {
    let authMailEntity;
    let authMailToken;
    try {
      authMailToken = await this._cacheManager.get<AuthMailToken>(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`);
    } catch (err) {
      this._logger.error(`getAuthMailEntity cache get failed, AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if(!authMailToken) {
      try {
        authMailEntity = await this._entityManager.getRepository(AuthMailEntity).findOne({
          relations: {
            user: true
          },
          join: {
            alias: "authMail",
            innerJoinAndSelect: {
              user: "authMail.user",
              userGroup: "user.userGroup",
              role: "userGroup.role"
            }
          },
          loadEagerRelations: true,
          where: {
            user: { id: userEntity.id },
            expiredAt: MoreThan(new Date()),
            mailType: AuthMailType.USER_VERIFICATION,
          },
        });
      } catch (error) {
        this._logger.error(
          `authMailRepository.findOne failed, userId: ${userEntity.id}`,
          error,
        );
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      if(authMailEntity) {
        try {
          await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`,
            { mailToken: authMailToken.mailToken, authMailEntity },
            { ttl: Math.round((authMailEntity.expiredAt.getTime() - Date.now()) / 1000) });
        } catch (err) {
          this._logger.error(`getAuthMailEntity cache set failed, AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`, err);
          throw new HttpException({
            statusCode: '500',
            message: 'Something Went Wrong',
            error: 'Internal Server Error'
          }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }
      return authMailEntity;
    } else {
      return authMailToken.authMailEntity
    }
  }
}
