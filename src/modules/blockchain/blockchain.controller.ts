import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
// import { TransactionRequestDto } from './dto/airdropRequest.dto';
// import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { ethers } from "ethers";

// import * as LivelyVerse from "@livelyverse/lively-core-onchain/export/types";
import { LivelyToken__factory } from '@livelyverse/lively-core-onchain/export/types'
import { LivelyToken } from "@livelyverse/lively-core-onchain/export/types/token/lively";
// import { LivelyToken } from "@livelyverse/lively-core-onchain/export/types/token/lively";
// const LivelyToken__factory = require('@livelyverse/lively-core-onchain/export/types/factories/token/lively/LivelyToken__factory')
const LivelyTokenABI = require("@livelyverse/lively-core-onchain/export/abi/LivelyToken.json");

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  // @Post()
  // create(@Body() createBlockchainDto: TransactionRequestDto) {
  //   return this.blockchainService.create(createBlockchainDto);
  // }
  //
  @Get()
  async findAll() {
    let customHttpProvider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
    let blockNumber = await customHttpProvider.getBlockNumber();

    let account = customHttpProvider.getSigner(0);
    // let factory = new LivelyToken__factory('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', account);
    // let token: LivelyToken = await factory.deploy();\
    // let token = LivelyVerse.Live
    let token = LivelyToken__factory.connect('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', account);
    // let token = new ethers.Contract('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318', LivelyTokenABI, customHttpProvider);
    // token.connect(account).attach('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318');
    let balance = await token.balanceOf('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    console.log(`balance ${balance}`)
    console.log(`Current block number: ${blockNumber}`);

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
