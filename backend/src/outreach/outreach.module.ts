import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outreach } from './outreach.entity';
import { OutreachService } from './outreach.service';
import { OutreachController } from './outreach.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Outreach])],
  providers: [OutreachService],
  controllers: [OutreachController],
  exports: [OutreachService],
})
export class OutreachModule {}
