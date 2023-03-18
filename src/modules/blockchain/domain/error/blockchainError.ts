import { BaseError } from "./baseError";

export enum ErrorCode {

  ///////////////////
  // Blockchain Module Error
  SAFE_MODE = "SAFE_MODE",

  INVALID_REQUEST = "INVALID_REQUEST",

  DB_OPERATION_FAILED = "DB_OPERATION_FAILED",

  NODE_JS_ERROR = "NODE_JS_ERROR",

  AIRDROP_REQUEST_LISTENER_NOT_FOUND = "AIRDROP_REQUEST_LISTENER_NOT_FOUND",

  INVALID_TX_RECEIPT = "INVALID_TX_RECEIPT",

  // Generic Errors
  // Unknown Error
  UNKNOWN_ERROR = "UNKNOWN_ERROR",

  // Not Implemented
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",

  // Unsupported Operation
  //   - operation
  UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION",

  // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
  //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
  NETWORK_ERROR = "NETWORK_ERROR",

  // Some sort of bad response from the server
  SERVER_ERROR = "SERVER_ERROR",

  // Some sort of bad response from the server
  SERVICE_NOT_READY = "SERVICE_NOT_READY",

  // Network Timeout
  NETWORK_TIMEOUT = "TIMEOUT",

  // Timer Timeout
  TIMER_TIMEOUT = "TIMER_TIMEOUT",

  ///////////////////
  // Operational  Errors

  // Buffer Overrun
  BUFFER_OVERRUN = "BUFFER_OVERRUN",

  // Numeric Fault
  //   - operation: the operation being executed
  //   - fault: the reason this faulted
  NUMERIC_FAULT = "NUMERIC_FAULT",


  ///////////////////
  // Argument Errors

  // Missing new operator to an object
  //  - name: The name of the class
  MISSING_NEW = "MISSING_NEW",

  // Invalid argument (e.g. value is incompatible with type) to a function:
  //   - argument: The argument name that was invalid
  //   - value: The value of the argument
  INVALID_ARGUMENT = "INVALID_ARGUMENT",

  // Missing argument to a function:
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  MISSING_ARGUMENT = "MISSING_ARGUMENT",

  // Too many arguments
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  UNEXPECTED_ARGUMENT = "UNEXPECTED_ARGUMENT",


  ///////////////////
  // Blockchain Errors

  // Call exception
  //  - transaction: the transaction
  //  - address?: the contract address
  //  - args?: The arguments passed into the function
  //  - method?: The Solidity method signature
  //  - errorSignature?: The EIP848 error signature
  //  - errorArgs?: The EIP848 error parameters
  //  - reason: The reason (only for EIP848 "Error(string)")
  CALL_EXCEPTION = "CALL_EXCEPTION",

  // Insufficient funds (< value + gasLimit * gasPrice)
  //   - transaction: the transaction attempted
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",

  // Nonce has already been used
  //   - transaction: the transaction attempted
  NONCE_EXPIRED = "NONCE_EXPIRED",

  // The replacement fee for the transaction is too low
  //   - transaction: the transaction attempted
  REPLACEMENT_UNDERPRICED = "REPLACEMENT_UNDERPRICED",

  // The gas limit could not be estimated
  //   - transaction: the transaction passed to estimateGas
  UNPREDICTABLE_GAS_LIMIT = "UNPREDICTABLE_GAS_LIMIT",

  // The transaction was replaced by one with a higher gas price
  //   - reason: "cancelled", "replaced" or "repriced"
  //   - cancelled: true if reason == "cancelled" or reason == "replaced")
  //   - hash: original transaction hash
  //   - replacement: the full TransactionsResponse for the replacement
  //   - receipt: the receipt of the replacement
  TRANSACTION_REPLACED = "TRANSACTION_REPLACED",
}

export class BlockchainError extends BaseError {
  public readonly event: string;
  public readonly code: ErrorCode;
  public readonly id: symbol;
  constructor(message, options: any) {
    super(new.target.name, message,options);
    this.event = options?.event;
    this.id = options?.id;
    this.code = options?.code
  }
}
