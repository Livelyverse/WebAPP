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
import { EntityManager, LessThan, MoreThan } from "typeorm";
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
    // if (dto instanceof Array) {
    //   this._logger.warn(
    //     `changeUserPassword Data Invalid, username: ${dto.username}`,
    //   );
    //   throw new HttpException({
    //     statusCode: '400',
    //     message: 'Request Data Invalid',
    //     error: 'Bad Request'
    //   }, HttpStatus.BAD_REQUEST)
    // }
    // const errors = await validate(dto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `changeUserPassword validation failed, username: ${dto.username}, errors: ${errors}`,
    //   );
    //
    //   throw new HttpException(
    //     { message: 'Input Data Invalid', errors },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }
    // const tokenPayload = await this.authTokenValidation(token, false);
    // let tokenEntity;
    // try {
    //   tokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
    //     relations: ['user'],
    //     where: {
    //       user: { id: tokenPayload.sub },
    //     },
    //   });
    // } catch (error) {
    //   this._logger.error(
    //     `changeUserPassword tokenRepository.findOne failed, userId: ${tokenPayload.sub}`,
    //     error,
    //   );
    //   throw new InternalServerErrorException({
    //     message: 'Something went wrong',
    //   });
    // }
    //
    // const user = tokenEntity.user;
    // if (!user.isActive) {
    //   this._logger.log(
    //     `changeUserPassword failed, user inactivated, username: ${user.username}`,
    //   );
    //   throw new ForbiddenException({ message: '' });
    // }
    // if (user.username !== dto.username) {
    //   this._logger.warn(
    //     `requested username doesn't match with user auth token, token user: ${user.username}, dto: ${dto.username}`,
    //   );
    //   throw new ForbiddenException({ message: '' });
    // }

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
    await this._cacheManager.set(`USER.EMAIL:${user.email}`, user, 0);

    // tokenEntity.isRevoked = true;
    // try {
    //   return this._tokenRepository.save(tokenEntity);
    // } catch (error) {
    //   this._logger.error(
    //     `_tokenRepository.save failed, tokenEntity Id: ${tokenEntity.id}, userId: ${user.id}`,
    //     error,
    //   );
    //   throw new InternalServerErrorException({
    //     message: 'Something went wrong',
    //   });
    // }
  }

  public async userAuthentication(dto: LoginDto, res: Response): Promise<void> {
    // if (dto instanceof Array) {
    //   this._logger.log(
    //     `userAuthentication Data Invalid, username: ${dto.username}`,
    //   );
    //   res
    //     .status(HttpStatus.BAD_REQUEST)
    //     .send({ message: 'Request Data Invalid' });
    //   return;
    // }
    //
    // const errors = await validate(dto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `userAuthentication data validation failed, username: ${dto.username}, errors: ${errors}`,
    //   );
    //
    //   res
    //     .status(HttpStatus.BAD_REQUEST)
    //     .send({ message: `Username Or Password Invalid`, errors });
    //   return;
    // }

    let user = await this._cacheManager.get<UserEntity>(`USER.EMAIL:${dto.email}`);
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

    // await this._cacheManager.set(`USER.EMAIL:${dto.email}`, user, 0);
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
      authMailEntity = await this.createAuthMailEntity(user, AuthMailType.USER_VERIFICATION, false);
    }
    const authMailToken = await this.generateAuthMailToken(authMailEntity);
    res.status(201).send({ access_token: authMailToken });
  }

  public async userSignUp(dto: SignupDto): Promise<string> {
    const userDto = new UserCreateDto();
    // userDto.username = dto.username;
    userDto.password = dto.password;
    userDto.email = dto.email;
    userDto.userGroup = 'GHOST';
    const user = await this._userService.create(userDto);
    const authMailEntity = await this.createAuthMailEntity(user, AuthMailType.USER_VERIFICATION, true);
    this._mailService.sendCodeConfirmation(
      // userDto.username,
      userDto.email,
      Number(authMailEntity.verificationId),
    );
    await this._cacheManager.set(`USER.EMAIL:${dto.email}`, user, this._mailTokenTTL / 1000);
    return await this.generateAuthMailToken(authMailEntity);
  }

  public async authMailCodeConfirmation(
    authMailToken: TokenPayload,
    verifyCode: string,
  ): Promise<AuthMailEntity> {
    if (!authMailToken.jti || authMailToken.exp * 1000 <= Date.now()) {
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    let authMailEntity = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_USER_VERIFICATION.ID:${authMailToken.jti}`);
    // if(!authMailEntity) {
    //   try {
    //     authMailEntity = await this._entityManager.getRepository(AuthMailEntity).findOne({
    //       where: {
    //         id: authMailToken.jti,
    //         mailType: AuthMailType.USER_VERIFICATION,
    //       },
    //     });
    //   } catch (error) {
    //     this._logger.error(
    //       `authMailRepository.findOne failed, id: ${authMailToken.jti}`,
    //       error,
    //     );
    //     throw new HttpException({
    //       statusCode: '500',
    //       message: 'Something Went Wrong',
    //       error: 'Internal Server Error'
    //     }, HttpStatus.INTERNAL_SERVER_ERROR);
    //   }
    // }
    if (!authMailEntity) {
      this._logger.warn(
        `authMailEntity not found, authToken: ${JSON.stringify(authMailToken)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (authMailEntity.verificationId !== verifyCode) {
      this._logger.warn(
        `verify code invalid, userId: ${authMailToken.sub}, code: ${verifyCode}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (!authMailEntity.user.isActive) {
      this._logger.warn(`user inactivated, userId: ${authMailToken.sub}`);
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
        `groupService.findByName for MEMBER userGroup failed, userId: ${authMailEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      authMailEntity.user.isEmailConfirmed = true;
      authMailEntity.user.userGroup = memberGroup;
      await this._entityManager.getRepository(AuthMailEntity).save(authMailEntity);
    } catch (error) {
      this._logger.error(
        `mailVerificationRepository.save failed, userId: ${authMailEntity.user.id}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    await this._cacheManager.set(`USER.EMAIL:${authMailEntity.user.email}`, authMailEntity.user, 0);
    await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${authMailEntity.user.id}`);
    await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.ID:${authMailToken.jti}`);
    return authMailEntity;
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

    const mailToken = await this.authTokenValidation(token, false);
    let authMailEntity = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_USER_VERIFICATION.ID:${mailToken.jti}`);
    if(!authMailEntity) {
      try {
        authMailEntity = await this._entityManager.getRepository(AuthMailEntity).findOne({
          where: {
            id: mailToken.jti,
            mailType: AuthMailType.USER_VERIFICATION,
          },
        });
      } catch (error) {
        this._logger.error(
          `authMailRepository.findOne of resendMailVerification failed, id: ${mailToken.jti}`,
          error,
        );
        throw new HttpException({
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!authMailEntity) {
        this._logger.warn(
          `authMail entity of token invalid, authMail id: ${mailToken.jti}`,
        );
        throw new HttpException({
          statusCode: '403',
          message: 'Forbidden',
          error: 'Forbidden'
        }, HttpStatus.FORBIDDEN);
      }
    }

    if (!dto || !dto.email) {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

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

    if(authMailEntity.expiredAt.getTime() < Date.now()) {
      authMailEntity = await this.createAuthMailEntity(user,  AuthMailType.USER_VERIFICATION, true);
    }
    this._mailService.sendCodeConfirmation(
      user.email,
      Number(authMailEntity.verificationId),
    );
  }

  public async sendForgetPasswordMail(req: Request, email: string): Promise<any> {
    let authMailEntity;
    let userEntity = await this._cacheManager.get<UserEntity>(`USER.EMAIL:${email}`);
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

    authMailEntity = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userEntity.id}`)
    if(!authMailEntity) {
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
    }

    if (authMailEntity) {
      this._logger.warn(`already sent forget password email, 
      email: ${email}, date: ${authMailEntity.mailSentAt} `);
      return;
    }

    authMailEntity = this.createAuthMailEntity(userEntity, AuthMailType.FORGOTTEN_PASSWORD, true)
    const absoluteUrl = `${req.protocol}://${req.get('host')}/api/auth/mail/password/reset/`
      + `${userEntity.id}/${authMailEntity.verificationId}`;
      // this._configService.get<string>('http.domain') +
    this._mailService.sendForgetPassword(
      userEntity.email,
      absoluteUrl,
    );
    await this._cacheManager.set(`USER.EMAIL:${email}`, userEntity, this._mailTokenTTL / 1000);
  }

  public async postUserResetPasswordHandler(
    userId: string,
    resetId: string,
    resetPasswordDto: PostResetPasswordDto,
  ): Promise<any> {
    let authMail = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
    // if(!authMail) {
    //   try {
    //     authMail = await this._entityManager.getRepository(AuthMailEntity).findOne({
    //       relations: ['user'],
    //       where: {
    //         user: { id: userId },
    //         verificationId: resetId,
    //         expiredAt: MoreThan(new Date()),
    //         mailType: AuthMailType.FORGOTTEN_PASSWORD,
    //       },
    //     });
    //   } catch (err) {
    //     this._logger.error(
    //       `authMailRepository.findOne failed, userId: ${userId}`,
    //       err,
    //     );
    //     throw new HttpException({
    //       statusCode: '500',
    //       message: 'Something Went Wrong',
    //       error: 'Internal Server Error'
    //     }, HttpStatus.INTERNAL_SERVER_ERROR);
    //   }
    // }

    if (!authMail) {
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
        `argon2.hash failed, email: ${authMail.user.email}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    authMail.user.password = hashPassword;
    await this._userService.updateEntity(authMail.user);
    await this._cacheManager.set(`USER.EMAIL:${authMail.user.email}`, authMail.user, 0);
    await this._cacheManager.del(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
  }

  public async getUserResetPasswordReq(
    userId: string,
    resetId: string,
  ): Promise<GetResetPasswordDto> {
    let authMailEntity = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID:${userId}`);
    // TODO check remove it
    // if(!authMailEntity) {
    //   try {
    //     authMailEntity = await this._entityManager.getRepository(AuthMailEntity).findOne({
    //       relations: ['user'],
    //       where: {
    //         user: { id: userId },
    //         verificationId: resetId,
    //         expiredAt: MoreThan(new Date()),
    //         mailType: AuthMailType.FORGOTTEN_PASSWORD,
    //       },
    //     });
    //   } catch (err) {
    //     this._logger.error(
    //       `authMailRepository.findOne failed, userId: ${userId}`,
    //       err,
    //     );
    //     throw new HttpException({
    //       statusCode: '500',
    //       message: 'Something Went Wrong',
    //       error: 'Internal Server Error'
    //     }, HttpStatus.INTERNAL_SERVER_ERROR);
    //   }
    // }

    if (!authMailEntity) {
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
    resetPasswordDto.id = authMailEntity.user.id;
    resetPasswordDto.email = authMailEntity.user.email;
    resetPasswordDto.resetPasswordId = authMailEntity.verificationId;
    return resetPasswordDto;
  }

  public async revokeAuthToken(userId: string, authToken: TokenPayload): Promise<AuthTokenEntity> {
    let authTokenEntity = await this._cacheManager.get<AuthTokenEntity>(`AUTH_TOKEN.USER_ID:${userId}`);
    if(!authTokenEntity) {
      authTokenEntity = await this._cacheManager.get<AuthTokenEntity>(`AUTH_ACCESS_TOKEN.ID:${authToken.jti}`);
      if (!authTokenEntity) {
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
      }
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

    await this._cacheManager.del(`AUTH_ACCESS_TOKEN.ID:${authToken.jti}`);
    await this._cacheManager.del(`AUTH_TOKEN.USER_ID:${userId}`);
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

    let authTokenEntity = await this._cacheManager.get<AuthTokenEntity>(`AUTH_ACCESS_TOKEN.ID:${payload.jti}`);
    // if(!authTokenEntity) {
    //   try {
    //     authTokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
    //       relations: ['user'],
    //       join: {
    //         alias: "token",
    //         innerJoinAndSelect: {
    //           user: "token.user",
    //           group: "user.group",
    //           role: "group.role"
    //         },
    //       },
    //       loadEagerRelations: true,
    //       where: {
    //         user: { id: payload.sub },
    //       },
    //     });
    //   } catch (error) {
    //     this._logger.error(
    //       `tokenRepository.findOne failed, userId: ${payload.sub}`,
    //       error,
    //     );
    //
    //     return new HttpException({
    //       statusCode: '500',
    //       message: 'Something Went Wrong',
    //       error: 'Internal Server Error'
    //     }, HttpStatus.INTERNAL_SERVER_ERROR);
    //   }
    // }
    if(!authTokenEntity) {
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
      !authTokenEntity.isRevoked &&
      authTokenEntity.user.isEmailConfirmed &&
      authTokenEntity.user.isActive
    ) {
      return authTokenEntity.user;
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

    let authTokenEntity = await this._cacheManager.get<AuthTokenEntity>(`AUTH_TOKEN.USER_ID:${payload.sub}`);
    // if(!authTokenEntity) {
    //   try {
    //     authTokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
    //       where: { id: payload.jti },
    //     });
    //   } catch (error) {
    //     this._logger.error(
    //       `authTokenRepository.findOne failed, refreshTokenId: ${payload.jti}, userId; ${payload.sub}`,
    //       error,
    //     );
    //     throw new HttpException({
    //       statusCode: '500',
    //       message: 'Something Went Wrong',
    //       error: 'Internal Server Error'
    //     }, HttpStatus.INTERNAL_SERVER_ERROR);
    //   }
    // }

    if (!authTokenEntity) {
      this._logger.log(
        `authTokenEntity not found, payload: ${JSON.stringify(payload)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    if (
      authTokenEntity.isRevoked ||
      Date.now() >= authTokenEntity.refreshTokenExpiredAt.getTime() ||
      payload.jti !== authTokenEntity.id
    ) {
      this._logger.log(
        `authTokenEntity is revoked or expired or invalid, authToken userId: ${
          authTokenEntity.user.id
        }, payload: ${JSON.stringify(payload)}`,
      );
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'Unauthorized'
      }, HttpStatus.UNAUTHORIZED);
    }

    const user = authTokenEntity.user;
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

    return authTokenEntity;
  }

  public async generateAuthMailToken(authMail: AuthMailEntity): Promise<string> {
    const payload = {
      iss: `https://${this._domain}`,
      sub: authMail.user.id,
      aud: `https://${this._domain}`,
      exp: Math.floor(authMail.expiredAt.getTime() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      jti: authMail.id,
    };
    const option = {
      algorithm: 'ES512' as Algorithm,
      privateKey: this._privateKey,
    };
    try {
      return await this._jwt.signAsync(payload, option);
    } catch (error) {
      this._logger.error(`jwt.signAsync failed, payload: ${payload}`, error);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async generateAccessToken(authTokenEntity: AuthTokenEntity): Promise<string> {

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

    await this._cacheManager.set(`AUTH_ACCESS_TOKEN.ID:${accessTokenId}`, authTokenEntity, this._accessTokenTTL / 1000);
    return accessToken;
  }

  public async generateRefreshToken(authTokenEntity: AuthTokenEntity): Promise<string> {
    const payload = {
      iss: `https://${this._domain}`,
      sub: authTokenEntity.user.id,
      aud: `https://${this._domain}`,
      exp: Math.floor(authTokenEntity.refreshTokenExpiredAt.getTime() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      jti: authTokenEntity.id,
    };

    const option = {
      algorithm: 'ES512' as Algorithm,
      privateKey: this._privateKey,
    };

    let refreshToken;
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
    return refreshToken;
  }

  public async getAuthTokenEntity(user: UserEntity): Promise<AuthTokenEntity> {
    let authTokenEntity = await this._cacheManager.get<AuthTokenEntity>(`AUTH_TOKEN.USER_ID:${user.id}`);
    if(!authTokenEntity) {
      try {
        authTokenEntity = await this._entityManager.getRepository(AuthTokenEntity).findOne({
          relations: ['user'],
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

    await this._cacheManager.set(`AUTH_TOKEN.USER_ID:${user.id}`, authTokenEntity, this._refreshTokenTTL / 1000);
    return authTokenEntity;
  }

  public async createAuthMailEntity(userEntity: UserEntity, mailType: AuthMailType, isEmailSent: boolean): Promise<AuthMailEntity> {
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

    if(isEmailSent) {
      authMailEntity.mailSentAt = new Date();
      authMailEntity.isEmailSent = true;
    } else {
      authMailEntity.mailSentAt = null;
      authMailEntity.isEmailSent = false;
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
    if(mailType === AuthMailType.USER_VERIFICATION) {
      await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.ID:${authMailEntity.id}`, authMailEntity, this._mailTokenTTL / 1000);
      await this._cacheManager.set(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`, authMailEntity, this._mailTokenTTL / 1000);
    } else if(mailType === AuthMailType.FORGOTTEN_PASSWORD) {
      await this._cacheManager.set(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID::${userEntity.id}`, authMailEntity, this._mailTokenTTL / 1000);
    }
    return authMailEntity;
  }

  public async getAuthMailEntity(userEntity: UserEntity): Promise<AuthMailEntity> {
    let authMail = await this._cacheManager.get<AuthMailEntity>(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${userEntity.id}`);
    if(!authMail) {
      try {
        authMail = await this._entityManager.getRepository(AuthMailEntity).findOne({
          relations: ['user'],
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
    }
    return authMail;
  }
}
