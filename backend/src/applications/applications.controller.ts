import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { ApplicationStatus } from './application.entity';

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private service: ApplicationsService) {}

  @Get()
  findAll(@Request() req) {
    return this.service.findByUser(req.user.id);
  }

  @Post()
  apply(@Request() req, @Body() body: { opportunityId: string; notes?: string }) {
    return this.service.apply(req.user.id, body.opportunityId, body.notes);
  }

  @Patch(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: ApplicationStatus },
  ) {
    return this.service.updateStatus(id, req.user.id, body.status);
  }
}
