import { DynamicModule, Global, Module, Provider, Type } from "@nestjs/common";
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { ProfileModule } from "../profile/profile.module";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlockchainTxEntity } from "./domain/entity/blockchainTx.entity";
import { BLOCK_CHAIN_MODULE_OPTIONS, BlockchainConfig } from "./blockchainConfig";
import { BlockchainAsyncOptions, BlockchainOptionFactory } from "./blockchainAsyncOptions";

@Global()
@Module({
  imports: [
    ProfileModule,
    ConfigModule,
    TypeOrmModule.forFeature([ BlockchainTxEntity]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get('blockchain.network.httpTimeout'),
      }),
      inject: [ConfigService],
    })
  ],
  // controllers: [BlockchainController],
  // providers: [BlockchainService]
})
export class BlockchainModule {

  public static forRoot(configs: BlockchainConfig): DynamicModule {
    return {
      module: BlockchainModule,
      controllers: [BlockchainController],
      providers: [BlockchainService,
        {
          provide: BLOCK_CHAIN_MODULE_OPTIONS,
          useValue: configs
        }
      ],
      exports: [BlockchainService]
    }
  }

  public static forRootAsync(asyncOptions: BlockchainAsyncOptions): DynamicModule {
    return {
      module: BlockchainModule,
      imports: asyncOptions.imports,
      controllers: [BlockchainController],
      providers: [BlockchainService, this.blockChainOptionFactory(asyncOptions)],
      exports: [BlockchainService]
    }
  }

  private static blockChainOptionFactory(asyncOptions: BlockchainAsyncOptions): Provider {
    if(asyncOptions.useFactory) {
      return {
        provide: BLOCK_CHAIN_MODULE_OPTIONS,
        useFactory: asyncOptions.useFactory,
        inject: asyncOptions.inject
      }
    }

    return {
      provide: BLOCK_CHAIN_MODULE_OPTIONS,
      useFactory: async (configFactory: BlockchainOptionFactory) =>
        await configFactory.createBlockchainOptions(),
      inject: [ asyncOptions.useExisting || asyncOptions.useClass ]
    }
  }
}
