import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineService } from './pipeline.service';

@UseGuards(JwtAuthGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private service: PipelineService) {}

  @Get()
  get(@Request() req) {
    return this.service.getByUser(req.user.id);
  }

  @Post('add')
  add(@Request() req, @Body() body: { url: string; company?: string; role?: string }) {
    return this.service.add(req.user.id, body.url, body.company, body.role);
  }

  @Post('remove')
  remove(@Request() req, @Body() body: { url: string }) {
    return this.service.remove(req.user.id, body.url);
  }

  @Post('done')
  markDone(@Request() req, @Body() body: { url: string }) {
    return this.service.markDone(req.user.id, body.url);
  }
}
