import { Test, TestingModule } from '@nestjs/testing';
import { SocialLivelyService } from '../services/socialLively.service';

describe('AirdropService', () => {
  let service: SocialLivelyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialLivelyService],
    }).compile();

    service = module.get<SocialLivelyService>(SocialLivelyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
