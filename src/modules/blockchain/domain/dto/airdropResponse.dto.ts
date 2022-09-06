
import { TxStatus } from "../entity/blockchainTx.entity";
import { TokenType } from "./airdropRequest.dto";

export class AirdropResponseDto {
  public id: symbol;
  public recordId: string;
  public tokenType: TokenType;
  public txHash: string
  public from: string
  public to: string
  public nonce: number
  public networkChainId: number
  public networkName: string
  public totalAmount: bigint
  public status: TxStatus
}
