import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JobsController } from './jobs.controller';

@Module({
  imports: [HttpModule],
  controllers: [JobsController],
})
export class JobsModule {}
