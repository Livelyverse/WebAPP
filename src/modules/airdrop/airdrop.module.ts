import { Module } from '@nestjs/common';
import { AirdropService } from './airdrop.service';
import { AirdropController } from './airdrop.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule
  ],
  controllers: [AirdropController],
  providers: [AirdropService]
})
export class AirdropModule {}
