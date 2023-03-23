export const BLOCK_CHAIN_MODULE_OPTIONS = Symbol('BLOCK_CHAIN_MODULE_OPTIONS');

export enum APP_MODE {
  DEV = "DEV",
  TEST = 'TEST',
  PROD = "PROD"
}

export interface BlockchainOptions {
  appMode: APP_MODE
  config: BlockchainConfig
}

export interface BlockchainConfig {
  network: BlockchainNetworkConfig
  accounts: Array<BlockchainAccountConfig>
  tokens: Array<BlockchainTokenConfig>
}

export interface BlockchainNetworkConfig {
  name: string
  type: string
  provider: string
  chainId: number
  url: string
  extraGasTip: number
  gasStationUrl: string
  networkCongest: number
  sendTxTimeout: number
  sendTxRetry: number
  jsonRpcTimeout: number
  httpTimeout: number
  confirmCount: number
  apiKey?: string
}

export interface BlockchainAccountConfig {
  name: string
  privateKey: string
  address: string
}

export interface BlockchainTokenConfig {
  name: string
  address: string
}