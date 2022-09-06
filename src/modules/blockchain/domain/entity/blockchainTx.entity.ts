import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";

export enum TxStatus {
  FAILED = "FAILED",
  SUCCESS = "SUCCESS",
  PENDING = "PENDING"
}

export enum TxType {
  LEGACY = 'LEGACY',
  DEFAULT = 'DEFAULT'
}

@Entity({ name: 'blockchain_tx' })
export class BlockchainTxEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  txHash: string

  @Column({ type: 'text', unique: false, nullable: false })
  txType: TxType

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  from: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  to: string

  @Column({ type: 'integer', unique: false, nullable: false })
  nonce: number

  @Column({ type: 'bigint', unique: false, nullable: false })
  gasLimit: bigint

  @Column({ type: 'bigint', unique: false, nullable: false })
  gasPrice: bigint

  @Column({ type: 'bigint', unique: false, nullable: false })
  maxFeePerGas: bigint

  @Column({ type: 'bigint', unique: false, nullable: false })
  maxPriorityFeePerGas: bigint

  @Column({ type: 'text', unique: false, nullable: false })
  data: string

  @Column({ type: 'bigint', unique: false, nullable: false })
  value: bigint

  @Column({ type: 'integer', unique: false, nullable: false })
  networkChainId: number

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  networkName: string

  // @Column({ type: 'timestamptz', nullable: true })
  // blockTimestamp?: Date

  @Column({ type: 'integer', nullable: true })
  blockNumber?: number

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  blockHash?: string

  @Column({ type: 'bigint', unique: false, nullable: true })
  gasUsed?: bigint

  @Column({ type: 'bigint', unique: false, nullable: true })
  effectiveGasPrice?: bigint

  @Column({ type: 'boolean', unique: false, nullable: true })
  isByzantium: boolean

  @Column({ type: 'text', unique: false, nullable: true })
  failInfo?: string

  @Column({ type: 'text', unique: false, nullable: false })
  status: TxStatus
}