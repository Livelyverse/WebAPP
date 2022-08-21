import { ModuleMetadata, Type } from "@nestjs/common";
import { BlockchainOptions } from "./blockchainConfig";

export interface BlockchainAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<BlockchainOptionFactory>;
  useClass?: Type<BlockchainOptionFactory>;
  useFactory?: (...args: any[]) => Promise<BlockchainOptions> | BlockchainOptions;
}

export interface BlockchainOptionFactory {
  createBlockchainOptions(): Promise<BlockchainOptions> | BlockchainOptions
}