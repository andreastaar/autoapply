import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrackerService } from './tracker.service';
import { PipelineService } from '../pipeline/pipeline.service';

@UseGuards(JwtAuthGuard)
@Controller('tracker')
export class TrackerController {
  constructor(
    private service: TrackerService,
    private pipeline: PipelineService,
  ) {}

  @Get()
  findAll(@Request() req) {
    return this.service.findByUser(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.service.create(req.user.id, body);
  }

  @Patch(':id/status')
  updateStatus(@Request() req, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, req.user.id, body.status);
  }

  @Post(':id/report')
  addReport(@Request() req, @Param('id') id: string, @Body() body: { content: string; filename: string }) {
    return this.service.addReport(id, req.user.id, body.content, body.filename);
  }

  @Get('stats')
  async getStats(@Request() req) {
    const [stats, pendingPipeline] = await Promise.all([
      this.service.getStats(req.user.id),
      this.pipeline.getPendingCount(req.user.id),
    ]);
    return { ...stats, pendingPipeline };
  }
}
