import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { ProfileModule } from '../modules/profile/profile.module';
import { MediumTaskService } from './domain/tasks/mediumRss.task';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogEntity } from './domain/entities/blog.entity';
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
