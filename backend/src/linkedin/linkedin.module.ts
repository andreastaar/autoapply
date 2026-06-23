import { Module } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';
import { LinkedinController } from './linkedin.controller';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [ProfileModule],
  providers: [LinkedinService],
  controllers: [LinkedinController],
  exports: [LinkedinService],
})
export class LinkedinModule {}
