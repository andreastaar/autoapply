import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OutreachService } from './outreach.service';
import { OutreachStatus } from './outreach.entity';

@UseGuards(JwtAuthGuard)
@Controller('outreach')
export class OutreachController {
  constructor(private service: OutreachService) {}

  @Get()
  findAll(@Request() req) {
    return this.service.findByUser(req.user.id);
  }

  @Get('stats')
  stats(@Request() req) {
    return this.service.stats(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.service.create(req.user.id, body);
  }

  @Patch(':id/status')
  updateStatus(@Request() req, @Param('id') id: string, @Body() body: { status: OutreachStatus }) {
    return this.service.updateStatus(id, req.user.id, body.status);
  }
}
