import { Test, TestingModule } from '@nestjs/testing';
import { SocialLivelyController } from '../controllers/socialLively.controller';
import { SocialLivelyService } from '../services/socialLively.service';

describe('AirdropController', () => {
  let controller: SocialLivelyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialLivelyController],
      providers: [SocialLivelyService],
    }).compile();

    controller = module.get<SocialLivelyController>(SocialLivelyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
