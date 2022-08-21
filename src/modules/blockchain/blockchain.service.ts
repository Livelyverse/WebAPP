import { Inject, Injectable, Logger } from "@nestjs/common";
// import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { LivelyToken } from '@livelyverse/lively-core-onchain/export/types/token/lively'
import { ethers, Signer } from "ethers";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { AirdropRequestDto } from "./dto/airdropRequest.dto";
import { APP_MODE, BLOCK_CHAIN_MODULE_OPTIONS, BlockchainConfig, BlockchainOptions } from "./blockchainConfig";

@Injectable()
export class BlockchainService {
  private readonly _logger = new Logger(BlockchainService.name);
  private readonly _systemAdmin: Signer;
  private readonly _admin: Signer;
  private readonly _assetManager: Signer;
  private readonly _taxTreasury: Signer;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    @Inject(BLOCK_CHAIN_MODULE_OPTIONS)
    private readonly _blockchainOptions: BlockchainOptions,
    private readonly _configService: ConfigService)
  {
    let systemAdmin = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'systemadmin');
    let admin = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'admin');
    let assetManager = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'assetmanager');
    let taxTreasury = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'taxtreasury')
    this._systemAdmin = new ethers.Wallet(systemAdmin.privateKey);
    this._admin = new ethers.Wallet(admin.privateKey);
    this._assetManager = new ethers.Wallet(assetManager.privateKey);
    this._taxTreasury = new ethers.Wallet(taxTreasury.privateKey);
  }

  async sendTx(airdropReq: AirdropRequestDto) {
    let token: LivelyToken;


  }

  // create(createBlockchainDto: TransactionRequestDto) {
  //   return 'This action adds a new blockchain';
  // }

  // findAll() {
  //
  //   let token: LivelyToken;
  //   let admin: Signer;
  //   let systemAdmin: Signer;
  //
  //   let customHttpProvider = new ethers.providers.JsonRpcProvider('https://boldest-small-river.ethereum-goerli.discover.quiknode.pro/b93d0ba5044bcc5bb7e2cd30a7850f51718ff058/');
  //   customHttpProvider.getBlockNumber().then((result) => {
  //     console.log("Current block number: " + result);
  //   });
  //
  //   return `This action returns all blockchain`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} blockchain`;
  // }
  //
  // update(id: number, updateBlockchainDto: UpdateBlockchainDto) {
  //   return `This action updates a #${id} blockchain`;
  // }
  //
  // remove(id: number) {
  //   return `This action removes a #${id} blockchain`;
  // }
}
