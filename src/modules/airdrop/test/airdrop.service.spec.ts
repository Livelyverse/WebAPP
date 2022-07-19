import { Test, TestingModule } from '@nestjs/testing';
import { AirdropService } from '../airdrop.service';

describe('AirdropService', () => {
  let service: AirdropService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AirdropService],
    }).compile();

    service = module.get<AirdropService>(AirdropService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
