import { BlockchainTxEntity, TxStatus, TxType } from "../entity/blockchainTx.entity";
import { ApiResponseProperty } from "@nestjs/swagger";


export class BlockchainTxViewDto {
  public static from(entity: BlockchainTxEntity): BlockchainTxViewDto | null {
    if(entity) {
      const view = new BlockchainTxViewDto();
      view.id = entity.id;
      view.txHash = entity.txHash;
      view.txType = entity.txType;
      view.from = entity.from;
      view.to = entity.to;
      view.nonce = entity.nonce;
      view.gasLimit = entity.gasLimit;
      view.gasPrice = entity.gasPrice;
      view.maxFeePerGas = entity.maxFeePerGas;
      view.maxPriorityFeePerGas = entity.maxPriorityFeePerGas;
      view.value = entity.value;
      view.networkChainId = entity.networkChainId;
      view.networkName = entity.networkName;
      view.blockNumber = entity.blockNumber;
      view.blockHash = entity.blockHash;
      view.gasUsed = entity.gasUsed;
      view.effectiveGasPrice = entity.effectiveGasPrice;
      view.isByzantium = entity.isByzantium;
      view.failInfo = entity.failInfo;
      view.status = entity.status;
      view.createdAt = entity.createdAt;
      view.updatedAt = entity.updatedAt;
      return view;
    }
    return null;
  }

  @ApiResponseProperty()
  id: string

  @ApiResponseProperty()
  txHash: string

  @ApiResponseProperty()
  txType: TxType

  @ApiResponseProperty()
  from: string

  @ApiResponseProperty()
  to: string

  @ApiResponseProperty()
  nonce: number

  @ApiResponseProperty()
  gasLimit: bigint

  @ApiResponseProperty()
  gasPrice: bigint

  @ApiResponseProperty()
  maxFeePerGas: bigint

  @ApiResponseProperty()
  maxPriorityFeePerGas: bigint

  @ApiResponseProperty()
  value: bigint

  @ApiResponseProperty()
  networkChainId: number

  @ApiResponseProperty()
  networkName: string

  @ApiResponseProperty()
  blockNumber?: number

  @ApiResponseProperty()
  blockHash?: string

  @ApiResponseProperty()
  gasUsed?: bigint

  @ApiResponseProperty()
  effectiveGasPrice?: bigint

  @ApiResponseProperty()
  isByzantium: boolean

  @ApiResponseProperty()
  failInfo?: string

  @ApiResponseProperty()
  status: TxStatus

  @ApiResponseProperty()
  createdAt: Date;

  @ApiResponseProperty()
  updatedAt: Date;
}