import { Controller, Get, Post, Body, Param, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get()
  findAll(@Request() req) {
    return this.service.findByUser(req.user.id);
  }

  @Get(':id')
  async getOne(@Request() req, @Param('id') id: string) {
    const report = await this.service.getByFilename(req.user.id, id)
      || await this.service.getById(req.user.id, id);
    if (!report) throw new NotFoundException();
    return report;
  }

  @Post()
  create(@Request() req, @Body() body: { filename: string; slug: string; content: string; date?: string }) {
    return this.service.create(req.user.id, body.filename, body.slug, body.content, body.date);
  }
}
