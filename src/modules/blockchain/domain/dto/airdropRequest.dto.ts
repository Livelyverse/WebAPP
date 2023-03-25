import { BigNumber } from "ethers";

export enum TokenType {
  LIV = "LIV"
}

export class AirdropRequestDto {

  public static from(id: symbol, tokenType: TokenType): AirdropRequestDto {
    const airdrop = new AirdropRequestDto();
    airdrop.id = id;
    airdrop.tokenType = tokenType;
    airdrop.data = [];
    return airdrop;
  }

  public id: symbol;
  public tokenType: TokenType;
  public data: Array<{destination: string, amount: BigNumber}>
  public signer?: string
}
