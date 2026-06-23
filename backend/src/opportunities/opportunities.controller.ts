import { Controller, Get, Post, Body, Param, Query, UseGuards, OnModuleInit } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityType } from './opportunity.entity';

@Controller('opportunities')
export class OpportunitiesController implements OnModuleInit {
  constructor(private service: OpportunitiesService) {}

  async onModuleInit() {
    await this.service.seed();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('type') type?: OpportunityType) {
    return this.service.findAll(type);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('import-linkedin')
  importLinkedin(@Body() body: { jobs: any[] }) {
    return this.service.importFromLinkedin(body.jobs);
  }
}
