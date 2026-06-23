import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from './opportunity.entity';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Opportunity])],
  providers: [OpportunitiesService],
  controllers: [OpportunitiesController],
})
export class OpportunitiesModule {}
