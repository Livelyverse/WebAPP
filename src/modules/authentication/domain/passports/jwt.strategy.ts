import * as passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from '../../authentication.service';

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
    const user = await this.authenticationService.accessTokenValidation(
      payload,
    );
    if (!user) {
      return done(new UnauthorizedException(), null, null);
    } else {
      return done(null, user, payload);
    }
  }
}
