// import * as request from 'supertest';
// import { INestApplication } from "@nestjs/common";
// import { BlogEntity } from "../domain/entity/blog.entity";
// import { BlogModule } from "../blog.module";
// import { Test } from "@nestjs/testing";
// import { BlogService } from "../blog.service";
//
//
// describe('Blog Controller end-2-end test', () => {
//   let app: INestApplication;
//   let blogService = { findAll: jest.fn(() => ({data: [new BlogEntity()], total: 1}))};
//
//   beforeAll(async () => {
//     const moduleRef = await Test.createTestingModule({
//       imports: [BlogModule]
//     })
//       .overrideProvider(BlogService)
//       .useValue(blogService)
//       .compile();
//
//     app = moduleRef.createNestApplication();
//     await app.init();
//   })
//
//   afterAll(async() => {
//     await app.close();
//   })
//
//   it('/findAll blogs', () => {
//     return request(app.getHttpServer())
//       .get('/findAll?page=1&offset=5&sortType=asc')
//       .expect(200)
//   })
// });