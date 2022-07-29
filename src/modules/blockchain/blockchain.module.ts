import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NetworkTxEntity } from "./entity/networkTx.entity";

@Module({
  imports: [
    ProfileModule,
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([ NetworkTxEntity])
  ],
  controllers: [BlockchainController],
  providers: [BlockchainService]
})
export class BlockchainModule {}
