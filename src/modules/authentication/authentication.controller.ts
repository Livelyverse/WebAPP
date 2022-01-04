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
} from '@nestjs/common';
import { LoginDto } from './domain/dto/login.dto';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from '../profile/services/user.service';
import { RefreshDto } from './domain/dto/refresh.dto';
import { Request } from 'express';
import * as argon2 from 'argon2';
import { UserCreateDto } from '../profile/domain/dto/userCreate.dto';
import { JwtAuthGuard } from './domain/gurads/jwt-auth.guard';
import { SigninDto } from './domain/dto/singin.dto';

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
  ) {}

  @Post('/signin')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'The user sign out successfully.' })
  @ApiResponse({ status: 400, description: 'Request Invalid' })
  @ApiResponse({ status: 404, description: 'User Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async login(@Body() body: LoginDto, @Res() res): Promise<any> {
    if (!body.username || !body.password) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send('Missing username or password.');
    }

    const user = await this.userService.findByName(body.username);

    if (!user) {
      this.logger.log(`user not found, username: ${body.username}`);
      return res
        .status(HttpStatus.NOT_FOUND)
        .send('Username Or Password Invalid');
    }

    if (!user.isActive || !user.isEmailConfirmed) {
      this.logger.log(
        `user deactivated or not confirmed, username: ${body.username}`,
      );
      return res
        .status(HttpStatus.NOT_FOUND)
        .send('Username Or Password Not Found');
    }

    let isPassVerify;
    try {
      isPassVerify = await argon2.verify(user.password, body.password);
    } catch (err) {
      this.logger.error(
        `argon2.hash failed, username: ${body.username}, password: ${body.password}`,
        err,
      );
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send('Something went wrong');
    }

    if (!isPassVerify) {
      this.logger.log(
        `user password verification failed, username: ${body.username}, password: ${body.password}`,
      );
      return res
        .status(HttpStatus.NOT_FOUND)
        .send('Username Or Password Not Found');
    }

    const { refreshToken, tokenEntity } =
      await this.authenticationService.generateRefreshToken(user);
    const accessToken = await this.authenticationService.generateAccessToken(
      user,
      tokenEntity,
    );

    return res.status(HttpStatus.OK).send({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  @Post('/signup')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'User sign up successful.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async signup(@Body() signinDto: SigninDto): Promise<TokenResponse> {
    if (signinDto instanceof Array) {
      this.logger.log(
        `create user failed, request ${JSON.stringify(signinDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }

    const userDto = new UserCreateDto();
    userDto.username = signinDto.username;
    userDto.password = signinDto.password;
    userDto.email = signinDto.email;
    userDto.group = 'GHOST';
    const user = await this.userService.create(userDto);

    const { refreshToken, tokenEntity } =
      await this.authenticationService.generateRefreshToken(user);
    const accessToken = await this.authenticationService.generateAccessToken(
      user,
      tokenEntity,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  @Post('/signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'User sign out successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Auth token not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  public async signout(@Req() request: any): Promise<void> {
    await this.authenticationService.revokeUserToken(request.user.id);
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

    await this.authenticationService.decodeAuthToken(token, true);

    if (!dto) {
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
