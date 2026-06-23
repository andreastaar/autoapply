import { Controller, Post, Get, Body, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LinkedinService } from './linkedin.service';
import { ProfileService } from '../profile/profile.service';

@UseGuards(JwtAuthGuard)
@Controller('linkedin')
export class LinkedinController {
  constructor(
    private linkedin: LinkedinService,
    private profile: ProfileService,
  ) {}

  private async getCreds(userId: string) {
    const p = await this.profile.findByUser(userId);
    return { liAt: p?.linkedinCookie || '', jsessionid: p?.linkedinJsessionid || '' };
  }

  @Get('jobs')
  async searchJobs(
    @Request() req,
    @Query('keywords') keywords: string,
    @Query('location') location: string,
    @Query('remote') remote: string,
    @Query('limit') limit: string,
  ) {
    const { liAt, jsessionid } = await this.getCreds(req.user.id);
    return this.linkedin.searchJobs(liAt, jsessionid, keywords, location, remote === 'true', Number(limit) || 10);
  }

  @Get('people')
  async searchPeople(
    @Request() req,
    @Query('keywords') keywords: string,
    @Query('company') company: string,
    @Query('title') title: string,
    @Query('limit') limit: string,
  ) {
    const { liAt, jsessionid } = await this.getCreds(req.user.id);
    return this.linkedin.searchPeople(liAt, jsessionid, keywords, company, title, Number(limit) || 10);
  }

  @Post('connect')
  async connect(@Request() req, @Body() body: { profileUrn: string; message?: string }) {
    const { liAt, jsessionid } = await this.getCreds(req.user.id);
    return this.linkedin.sendConnection(liAt, jsessionid, body.profileUrn, body.message);
  }

  @Post('message')
  async message(@Request() req, @Body() body: { profileUrns: string[]; message: string }) {
    const { liAt, jsessionid } = await this.getCreds(req.user.id);
    return this.linkedin.sendMessage(liAt, jsessionid, body.profileUrns, body.message);
  }

  @Get('me')
  async getMyProfile(@Request() req) {
    const { liAt, jsessionid } = await this.getCreds(req.user.id);
    return this.linkedin.getProfile(liAt, jsessionid);
  }
}
