// import { Test } from '@nestjs/testing';
// import { AuthenticationService } from '../../authentication.service';
// import { ProfileModule } from '../../../profile/profile.module';
// import { UserService } from '../../../profile/user.service';
//
// describe('AuthenticationService', () => {
//   let authenticationService: AuthenticationService;
//
//   beforeEach(async () => {
//     const module = await Test.createTestingModule({
//       imports: [ProfileModule],
//       providers: [AuthenticationService],
//     })
//       .overrideComponent(UserService)
//       .useValue({ findOne: () => true })
//       .compile();
//
//     authenticationService = module.get<AuthenticationService>(
//       AuthenticationService,
//     );
//   });
//
//   it('should return a token', async () => {
//     const result = authenticationService.createToken('test@test.fr');
//
//     expect(result).not.toBeNull();
//     expect(result.access_token).not.toBeNull();
//     expect(result.expires_in).toBe(3600);
//   });
//
//   it('should validate the profile', async () => {
//     const result = await authenticationService.validateUser({
//       email: 'test@test.fr',
//       password: 'password',
//     });
//
//     expect(result).toBe(true);
//   });
// });
