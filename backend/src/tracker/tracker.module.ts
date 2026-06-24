import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackerEntry } from './tracker.entity';
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrackerEntry]), PipelineModule],
  providers: [TrackerService],
  controllers: [TrackerController],
  exports: [TrackerService],
})
export class TrackerModule {}
