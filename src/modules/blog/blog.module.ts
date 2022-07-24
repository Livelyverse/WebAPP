import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { ProfileModule } from '../profile/profile.module';
import { MediumTaskService } from './domain/task/mediumRss.task';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogEntity } from './domain/entity/blog.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([BlogEntity]),
  ],
  controllers: [BlogController],
  providers: [BlogService, MediumTaskService],
})
export class BlogModule {}
