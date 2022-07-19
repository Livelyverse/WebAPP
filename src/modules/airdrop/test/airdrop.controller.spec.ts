import { Test, TestingModule } from '@nestjs/testing';
import { AirdropController } from '../airdrop.controller';
import { AirdropService } from '../airdrop.service';

describe('AirdropController', () => {
  let controller: AirdropController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirdropController],
      providers: [AirdropService],
    }).compile();

    controller = module.get<AirdropController>(AirdropController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
