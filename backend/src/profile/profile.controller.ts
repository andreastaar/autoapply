import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private service: ProfileService) {}

  @Get()
  get(@Request() req) {
    return this.service.findByUser(req.user.id);
  }

  @Put()
  update(@Request() req, @Body() body: any) {
    return this.service.upsert(req.user.id, body);
  }
}
