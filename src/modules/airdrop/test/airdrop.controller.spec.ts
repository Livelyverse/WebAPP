import { Test, TestingModule } from '@nestjs/testing';
import { AirdropController } from '../controllers/airdrop.controller';
import { SocialLivelyService } from '../services/socialLively.service';

describe('AirdropController', () => {
  let controller: AirdropController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirdropController],
      providers: [SocialLivelyService],
    }).compile();

    controller = module.get<AirdropController>(AirdropController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
