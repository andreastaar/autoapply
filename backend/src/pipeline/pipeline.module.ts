import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineItem } from './pipeline.entity';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PipelineItem])],
  providers: [PipelineService],
  controllers: [PipelineController],
  exports: [PipelineService],
})
export class PipelineModule {}
