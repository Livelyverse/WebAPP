import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
// import { TransactionRequestDto } from './dto/airdropRequest.dto';
// import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { ethers } from "ethers";

// import * as LivelyVerse from "@livelyverse/lively-core-onchain/export/types";
import { LivelyToken__factory } from '@livelyverse/lively-core-onchain/export/types'
import { LivelyToken } from "@livelyverse/lively-core-onchain/export/types/token/lively";
import { AirdropRequestDto, TokenType } from "./dto/airdropRequest.dto";
// import { LivelyToken } from "@livelyverse/lively-core-onchain/export/types/token/lively";
// const LivelyToken__factory = require('@livelyverse/lively-core-onchain/export/types/factories/token/lively/LivelyToken__factory')
const LivelyTokenABI = require("@livelyverse/lively-core-onchain/export/abi/LivelyToken.json");

@Controller('/api/blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  // @Post()
  // create(@Body() createBlockchainDto: TransactionRequestDto) {
  //   return this.blockchainService.create(createBlockchainDto);
  // }
  //
  @Get('/findAllTest')
  async findAllTest() {

    let request = new AirdropRequestDto();
    request.id = Symbol.for('AirDropReq_2')
    request.signer = 'admin';
    request.tokenType = TokenType.LVL;
    request.data = [];
    request.data.push({ destination: "dest1", amount: 11n })
    console.log(`findAllTest reqId: ${String(request.id)}`)
    let response = await this.blockchainService.sendAirdropTx(request);
    console.log(`findAllTest txId: ${String(response.id)}`);
  }

  @Get('/findAll')
  async findAll() {

    let request = new AirdropRequestDto();
    request.id = Symbol.for('AirDropReq_1')
    request.signer = 'admin';
    request.tokenType = TokenType.LVL;
    request.data = [];
    request.data.push({destination: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", amount: 100n * (10n ** 18n)});
    request.data.push({destination: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0xBcd4042DE499D14e55001CcbB24a551F3b954096", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0xcd3B766CCDd6AE721141F452C550Ca635964ce71", amount: 100n * (10n ** 18n)})
    request.data.push({destination: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", amount: 100n * (10n ** 18n)})


    console.log(`findAll reqId: ${String(request.id)}`)
    let response = await this.blockchainService.sendAirdropTx(request);
    console.log(`findAll txId: ${String(response.id)}, balance: ${response.totalAmount.toString()} `);


    // let customHttpProvider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
    // let blockNumber = await customHttpProvider.getBlockNumber();
    //
    // let account = customHttpProvider.getSigner(0);
    // // let factory = new LivelyToken__factory('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', account);
    // // let token: LivelyToken = await factory.deploy();\
    // // let token = LivelyVerse.Live
    // let token = LivelyToken__factory.connect('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', account);
    // // let token = new ethers.Contract('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', LivelyTokenABI, customHttpProvider);
    // // token.connect(account).attach('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318');
    // let balance = await token.balanceOf('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    // console.log(`balance ${balance}`)
    // console.log(`Current block number: ${blockNumber}`);

    // });
    // return this.blockchainService.findAll();
  }
  //
  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.blockchainService.findOne(+id);
  // }
  //
  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateBlockchainDto: UpdateBlockchainDto) {
  //   return this.blockchainService.update(+id, updateBlockchainDto);
  // }
  //
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.blockchainService.remove(+id);
  // }
}
