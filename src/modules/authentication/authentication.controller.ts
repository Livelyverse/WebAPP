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
  BadRequestException,
  Get,
} from '@nestjs/common';
import { LoginDto } from './domain/dto/login.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshDto } from './domain/dto/refresh.dto';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './domain/gurads/jwt-auth.guard';
import { SignupDto } from './domain/dto/signup.dto';
import { AuthMailDto, ResendAuthMailDto } from './domain/dto/verification.dto';
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
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('/signin')
  @ApiResponse({
    status: 200,
    description: 'The verify user login successfully.',
  })
  @ApiResponse({
    status: 201,
    description: 'The does not verified user login successfully.',
  })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
  ): Promise<void> {
    const dto = LoginDto.from(loginDto);
    await this.authenticationService.userAuthentication(dto, res);
  }

  @Post('/changepassword')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Change Password Success.' })
  @ApiResponse({ status: 400, description: 'Request Invalid.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async changePassword(
    @Body() passwordDto: PasswordDto,
    @Req() req,
  ): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const dto = PasswordDto.from(passwordDto);
    await this.authenticationService.changeUserPassword(token, dto);
  }

  @Post('/signup')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'User sign up success.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signup(@Body() signupDto: SignupDto): Promise<any> {
    const dto = SignupDto.from(signupDto);
    const accessToken = await this.authenticationService.userSignUp(dto);
    return {
      access_token: accessToken,
    };
  }

  @Post('/signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'User sign out successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
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
    @Body() authMailDto: AuthMailDto,
  ): Promise<TokenResponse> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException({ message: '' });
    }

    const dto = AuthMailDto.from(authMailDto);
    if (!dto || !dto.verifyCode) {
      this.logger.log(
        `request mail verification invalid, ${JSON.stringify(authMailDto)}`,
      );
      throw new BadRequestException({ message: 'Invalid Input Date' });
    }

    const tokenPayload = await this.authenticationService.authTokenValidation(
      token,
      false,
    );

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

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
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
    @Body() resendAuthMailDto: ResendAuthMailDto,
    @Req() req: Request,
  ): Promise<any> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const dto = ResendAuthMailDto.from(resendAuthMailDto);
    if (!dto || !dto.username) {
      this.logger.log(
        `request mail resend verification invalid, ${JSON.stringify(
          resendAuthMailDto,
        )}`,
      );
      throw new BadRequestException({ message: 'Invalid Input Date' });
    }

    await this.authenticationService.resendMailVerification(
      resendAuthMailDto,
      token,
    );
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
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
      throw new UnauthorizedException({ message: '' });
    }

    await this.authenticationService.authTokenValidation(token, true);

    const dto = RefreshDto.from(refreshDto);
    if (!dto || !dto.refresh_token) {
      this.logger.log(
        `request refresh token invalid, ${JSON.stringify(refreshDto)}`,
      );
      throw new BadRequestException({ message: 'Invalid Input Date' });
    }

    const accessToken =
      await this.authenticationService.createAccessTokenFromRefreshToken(dto);

    return {
      access_token: accessToken,
      refresh_token: dto.refresh_token,
    };
  }
}
