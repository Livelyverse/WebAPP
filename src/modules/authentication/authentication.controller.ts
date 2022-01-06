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
    @Body() body: LoginDto,
    @Res() res: Response,
  ): Promise<Response> {
    return await this.authenticationService.userAuthentication(body, res);
  }

  @Post('/changepass')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'The user sign out successfully.' })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async changePassword(
    @Body() body: PasswordDto,
    @Req() req,
  ): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    await this.authenticationService.changeUserPassword(token, body);
  }

  @Post('/signup')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'User sign up successful.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signup(@Body() body: SignupDto): Promise<any> {
    if (body instanceof Array) {
      this.logger.log(`signup failed, dto: ${body.username}`);
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const accessToken = await this.authenticationService.userSignUp(body);
    return {
      access_token: accessToken,
    };
  }

  @Get('/signout')
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
  ): Promise<TokenResponse> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Illegal Auth Token');
    }

    const tokenPayload = await this.authenticationService.authTokenValidation(
      token,
      false,
    );

    if (!dto || !dto.verifyCode) {
      throw new BadRequestException('Illegal Auth Token ');
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
    @Body() body: ResendAuthMailDto,
    @Req() req: Request,
  ): Promise<any> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    await this.authenticationService.resendMailVerification(body, token);
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
  ): Promise<TokenResponse> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Illegal Auth Token');
    }

    await this.authenticationService.authTokenValidation(token, true);

    if (!dto || !dto.refresh_token) {
      throw new BadRequestException('Illegal Auth Token');
    }

    const accessToken =
      await this.authenticationService.createAccessTokenFromRefreshToken(dto);

    return {
      access_token: accessToken,
      refresh_token: dto.refresh_token,
    };
  }
}
