import * as passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticationService } from '../../authentication.service';
import { UserEntity } from '../../../profile/domain/entity';

@Injectable()
export default class JwtStrategy extends Strategy {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(private readonly authenticationService: AuthenticationService) {
    super(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        passReqToCallback: true,
        secretOrKey: authenticationService.publicKey,
        ignoreExpiration: true,
        issuer: 'https://livelyplanet.io',
        audience: 'https://livelyplanet.io',
        algorithms: ['ES512'],
      },
      async (req, payload, next) => {
        return await this.verify(req, payload, next);
      },
    );
    passport.use(this);
  }

  public async verify(req, payload, done) {
    const obj = await this.authenticationService.accessTokenValidation(payload);

    if (obj instanceof UserEntity) {
      return done(null, obj, payload);
    } else {
      return done(
        new HttpException({ message: '' }, obj as HttpStatus),
        null,
        null,
      );
    }
  }
}
