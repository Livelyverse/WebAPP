enum TokenType {
  LVL = "LVL"
}

export class AirdropRequestDto {
  public tokenType: TokenType;
  public data: Array<{destination: string, amount: bigint}>
  public signer?: string
}
