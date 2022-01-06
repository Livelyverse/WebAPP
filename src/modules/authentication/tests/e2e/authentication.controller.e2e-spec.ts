// import { Test } from '@nestjs/testing';
// import express from 'express';
// import request from 'supertest';
// import { AuthenticationController } from '../../authentication.controller';
// import { AuthenticationService } from '../../authentication.service';
// import { ProfileModule } from "../../../profile/profile.module";
// import { UserService } from "../../../profile/services/user.service";
//
// describe('UserController', () => {
//   const server = express();
//   const userService = {
//     findOne: () => ({ firstName: 'fake' }),
//   };
//
//   beforeAll(async () => {
//     const module = await Test.createTestingModule({
//       imports: [ProfileModule],
//       controllers: [AuthenticationController],
//       providers: [AuthenticationService],
//     })
//       .overrideComponent(UserService)
//       .useValue(userService)
//       .compile();
//
//     const app = module.createNestApplication(server);
//     await app.init();
//   });
//
//   it('should return bad request', async () => {
//     return request(server).post('/login').send({}).expect(400);
//   });
//
//   it('should return expires_in and access_token', async () => {
//     return request(server)
//       .post('/login')
//       .send({ email: 'test@test.fr', password: 'password' })
//       .expect((res) => {
//         expect(res.body.expires_in).toBe(3600);
//         expect(res.body.access_token).not.toBeNull();
//       });
//   });
// });
