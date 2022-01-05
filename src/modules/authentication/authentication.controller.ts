import { AuthenticationService, TokenPayload } from './authentication.service';
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
} from '@nestjs/common';
import { LoginDto } from './domain/dto/login.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from '../profile/services/user.service';
import { RefreshDto } from './domain/dto/refresh.dto';
import { Request } from 'express';
import * as argon2 from 'argon2';
import { UserCreateDto } from '../profile/domain/dto/userCreate.dto';
import { JwtAuthGuard } from './domain/gurads/jwt-auth.guard';
import { SignupDto } from './domain/dto/signup.dto';
import { MailService } from '../mail/mail.service';
import { AuthMailDto } from './domain/dto/verification.dto';
import { PasswordDto } from './domain/dto/password.dto';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

@ApiBearerAuth()
@Controller('/api/auth')
@ApiTags('authentication')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name);
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  @Post('/signin')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'The user sign out successfully.' })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async login(@Body() body: LoginDto, @Res() res): Promise<any> {
    const tokenResponse = await this.authenticationService.userAuthentication(
      body,
    );

    return res.status(HttpStatus.OK).send(tokenResponse);
  }

  @Post('/changepass')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'The user sign out successfully.' })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async changePassword(
    @Body() body: PasswordDto,
    @Req() req,
    @Res() res,
  ): Promise<any> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Illegal Auth Token');
    }
    await this.authenticationService.changeUserPassword(token, body);
    return res.status(HttpStatus.OK);
  }

  @Post('/signup')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'User sign up successful.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signup(@Body() signupDto: SignupDto, @Res() res): Promise<any> {
    if (signupDto instanceof Array) {
      this.logger.log(`signup failed, dto: ${signupDto.username}`);
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const userDto = new UserCreateDto();
    userDto.username = signupDto.username;
    userDto.password = signupDto.password;
    userDto.email = signupDto.email;
    userDto.group = 'GHOST';
    const user = await this.userService.create(userDto);

    const authMailEntity =
      await this.authenticationService.createAuthMailEntity(user);

    await this.mailService.sendCodeConfirmation(
      userDto.username,
      userDto.email,
      Number(authMailEntity.verificationId),
    );

    const accessToken = await this.authenticationService.generateAuthMailToken(
      user,
      authMailEntity,
    );
    return res.status(HttpStatus.OK).send({
      access_token: accessToken,
    });
  }

  @Post('/signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'User sign out successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Auth token not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async signout(@Req() request: any): Promise<void> {
    await this.authenticationService.revokeAuthToken(request.user.id);
  }

  @Post('/mail/verify')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'User verification successful.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async mailVerification(
    @Req() req: Request,
    @Body() dto: AuthMailDto,
    @Res() res,
  ): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Illegal Auth Token');
    }

    const tokenPayload = await this.authenticationService.authTokenValidation(
      token,
      false,
    );

    if (!dto || dto?.verifyCode) {
      return res.status(HttpStatus.BAD_REQUEST).send('Illegal Auth Token ');
    }

    const authMail = await this.authenticationService.authMailCodeConfirmation(
      tokenPayload,
      dto.verifyCode,
    );
    const { refreshToken, tokenEntity } =
      await this.authenticationService.generateRefreshToken(authMail.user);
    const accessToken = await this.authenticationService.generateAccessToken(
      authMail.user,
      tokenEntity,
    );

    return res.status(HttpStatus.OK).send({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  @Post('/mail/resend')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Resend mail successful.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async resendMailVerification(
    @Req() req: Request,
    @Res() res,
  ): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Illegal Auth Token');
    }

    const tokenPayload = await this.authenticationService.authTokenValidation(
      token,
      false,
    );

    const user = await this.authenticationService.getUserFromTokenPayload(
      tokenPayload,
    );
    const authMailEntity =
      await this.authenticationService.createAuthMailEntity(user);

    await this.mailService.sendCodeConfirmation(
      user.username,
      user.email,
      Number(authMailEntity.verificationId),
    );

    const accessToken = await this.authenticationService.generateAuthMailToken(
      user,
      authMailEntity,
    );
    return res.status(HttpStatus.OK).send({
      access_token: accessToken,
    });
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Generate accessToken successful.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async refresh(
    @Req() req: Request,
    @Body() dto: RefreshDto,
    @Res() res,
  ) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).send('Illegal Auth Token');
    }

    await this.authenticationService.authTokenValidation(token, true);

    if (!dto || dto?.refresh_token) {
      return res.status(HttpStatus.BAD_REQUEST).send('Illegal Auth Token ');
    }

    const accessToken =
      await this.authenticationService.createAccessTokenFromRefreshToken(dto);

    return res.status(HttpStatus.OK).send({
      access_token: accessToken,
      refresh_token: dto.refresh_token,
    });
  }
}
