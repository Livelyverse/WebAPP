import { AuthenticationService } from './authentication.service';
import {
  Controller,
  Post,
  HttpStatus,
  HttpCode,
  Res,
  Body,
  HttpException,
  Logger,
  UseGuards,
  Req,
  UnauthorizedException,
  Get,
  Param, ParseUUIDPipe, UsePipes
} from "@nestjs/common";
import { LoginDto } from './domain/dto/login.dto';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshDto } from './domain/dto/refresh.dto';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './domain/gurad/jwt-auth.guard';
import { SignupDto } from './domain/dto/signup.dto';
import { AuthMailDto, ResendAuthMailDto } from './domain/dto/verification.dto';
import {
  ChangePasswordDto,
  GetResetPasswordDto,
  PostResetPasswordDto,
} from './domain/dto/password.dto';
import * as Joi from 'joi';
import { ValidationPipe } from "./domain/pipe/validationPipe";
import { UserEntity } from "../profile/domain/entity";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

@ApiBearerAuth()
@Controller('/api/auth')
@ApiTags('authentication')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name);
  constructor(private readonly _authenticationService: AuthenticationService) {}

  @Post('/signin')
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiResponse({
    status: 200,
    description: 'Verified User Login Successfully.',
  })
  @ApiResponse({
    status: 201,
    description: 'Not verified User Login Successfully.',
  })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
  ): Promise<void> {
    // const dto = LoginDto.from(loginDto);
    await this._authenticationService.userAuthentication(loginDto, res);
  }

  @Post('/change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Change Password Success.' })
  @ApiResponse({ status: 400, description: 'Request Invalid.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async changePassword(
    @Body() passwordDto: ChangePasswordDto,
    @Req() req,
  ): Promise<void> {
    // const authHeader = req.headers['authorization'];
    // const token = authHeader && authHeader.split(' ')[1];

    // const dto = ChangePasswordDto.from(passwordDto);
    await this._authenticationService.changeUserPassword(req.user, passwordDto);
  }

  @Post('/signup')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiResponse({
    status: 200,
    description: 'User Signup Success.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signup(@Body() signupDto: SignupDto): Promise<any> {
    // const dto = SignupDto.from(signupDto);
    const accessToken = await this._authenticationService.userSignUp(signupDto);
    return {
      access_token: accessToken,
    };
  }

  @Post('/signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'User sign out successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async signout(@Req() request: any): Promise<void> {
    await this._authenticationService.revokeAuthToken(request.user.id);
  }

  @Post('/mail/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Verification Success.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async mailVerification(
    @Req() req: Request,
    @Body() authMailDto: AuthMailDto,
  ): Promise<TokenResponse> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'UNAUTHORIZED'
      }, HttpStatus.UNAUTHORIZED);
    }

    // const dto = AuthMailDto.from(authMailDto);
    // if (!dto || !dto.verifyCode) {
    //   this.logger.warn(
    //     `request mail verification invalid, ${JSON.stringify(authMailDto)}`,
    //   );
    //   throw new HttpException({
    //     statusCode: '400',
    //     message: 'Invalid Input Date',
    //     error: 'Bad Request'
    //   }, HttpStatus.BAD_REQUEST);
    // }

    const tokenPayload = await this._authenticationService.authTokenValidation(
      token,
      false,
    );
    const authMailEntity = await this._authenticationService.authMailCodeConfirmation(
      tokenPayload,
      authMailDto.verifyCode,
    );

    const authTokenEntity = await this._authenticationService.createAuthTokenEntity(UserEntity.from(authMailEntity.user));
    const refreshToken = await this._authenticationService.generateRefreshToken(authTokenEntity);
    const accessToken = await this._authenticationService.generateAccessToken(authTokenEntity);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  @Post('/mail/resend')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Resend Mail Successful.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async resendMailVerification(
    @Body() resendAuthMailDto: ResendAuthMailDto,
    @Req() req: Request,
  ): Promise<any> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // const dto = ResendAuthMailDto.from(resendAuthMailDto);
    // if (!dto || !dto.username) {
    //   this.logger.warn(
    //     `request mail resend verification invalid, ${JSON.stringify(
    //       resendAuthMailDto,
    //     )}`,
    //   );
    //   throw new HttpException({
    //     statusCode: '400',
    //     message: 'Invalid Input Date',
    //     error: 'Bad Request'
    //   }, HttpStatus.BAD_REQUEST);
    // }

    await this._authenticationService.resendMailVerification(
      resendAuthMailDto,
      token,
    );
  }

  @Post('/mail/password/forget/:email')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'email',
    required: true,
    description: 'user email address',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Forget Password Mail Send Successful.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'User Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async sendForgetPasswordMail(@Req() req: Request, @Param() emailParam): Promise<any> {
    const schema = Joi.object({
      email: Joi.string().email(),
    });
    const validationResult = schema.validate(emailParam);
    if (validationResult.error) {
      this.logger.debug(
        `email address invalid, email: ${emailParam}, error: ${validationResult.error.message}`,
      );
      throw new HttpException({
        statusCode: '400',
        message: validationResult.error.message,
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }
    await this._authenticationService.sendForgetPasswordMail(req, emailParam.email);
  }

  @Post('/mail/password/reset/:userid/:resetid')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiParam({
    name: 'userid',
    required: true,
    description: 'user Id of requested reset password',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'resetid',
    required: true,
    description: 'reset password Id',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Reset Password Successful.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'User Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async userResetPassword(
    @Param('userid', new ParseUUIDPipe()) userid: string,
    @Param('resetid', new ParseUUIDPipe()) resetid: string,
    @Body() resetPasswordDto: PostResetPasswordDto,
  ): Promise<any> {

    // const dto = PostResetPasswordDto.from(resetPasswordDto);
    // const errors = await validate(dto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this.logger.log(
    //     `resetPassword validation failed, userId: ${userid}, errors: ${errors}`,
    //   );
    //
    //   throw new HttpException({
    //     statusCode: '400',
    //     message: 'Invalid Input Date',
    //     error: 'Bad Request'
    //   }, HttpStatus.BAD_REQUEST);
    //
    //   throw new HttpException(
    //     { message: 'New Password Invalid', errors },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    await this._authenticationService.postUserResetPasswordHandler(
      userid,
      resetid,
      resetPasswordDto,
    );
  }

  @Get('/mail/password/reset/:userid/:resetid')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'user Id of requested reset password',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'resetid',
    required: true,
    description: 'reset password Id',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Get Reset Password Success',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'User Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async getUserResetPasswordReq(
    @Param('userid', new ParseUUIDPipe()) userid: string,
    @Param('resetid', new ParseUUIDPipe()) resetid: string,
  ): Promise<GetResetPasswordDto> {
    // if (!isUUID(userId)) {
    //   this.logger.debug(`userId invalid, userId: ${userId}`);
    //   throw new BadRequestException({
    //     message: 'User Id Invalid',
    //   });
    // }
    //
    // if (!isUUID(resetId)) {
    //   this.logger.debug(`resetId invalid, resetId: ${userId}`);
    //
    //   throw new HttpException(
    //     { message: 'Reset Password Id Invalid' },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    return await this._authenticationService.getUserResetPasswordReq(
      userid,
      resetid,
    );
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: false,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Generate accessToken success.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async refresh(
    @Req() req: Request,
    @Body() refreshDto: RefreshDto,
  ): Promise<TokenResponse> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new HttpException({
        statusCode: '401',
        message: 'Unauthorized',
        error: 'UNAUTHORIZED'
      }, HttpStatus.UNAUTHORIZED);
    }

    await this._authenticationService.authTokenValidation(token, true);

    // const dto = RefreshDto.from(refreshDto);
    // if (!dto || !dto.refresh_token) {
    //   this.logger.log(
    //     `request refresh token invalid, ${JSON.stringify(refreshDto)}`,
    //   );
    //   throw new BadRequestException({ message: 'Invalid Input Date' });
    // }

    // const accessToken =
    //   await this._authenticationService.createAccessTokenFromRefreshToken(refreshDto);

    const authTokenEntity = await this._authenticationService.resolveRefreshToken(refreshDto.refresh_token);
    const accessToken = await this._authenticationService.generateAccessToken(authTokenEntity)
    return {
      access_token: accessToken,
      refresh_token: refreshDto.refresh_token,
    };
  }
}
