import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Request, UseGuards, Res, StreamableFile,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { firstValueFrom } from 'rxjs';

const AUTOPILOT = process.env.AUTOPILOT_URL || 'http://localhost:8800';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private http: HttpService) {}

  private async fwd(method: string, path: string, body?: any) {
    try {
      const url = `${AUTOPILOT}${path}`;
      const obs = method === 'GET'
        ? this.http.get(url)
        : this.http.post(url, body, { headers: { 'Content-Type': 'application/json' } });
      const res = await firstValueFrom(obs);
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.error || e.message || 'autopilot unreachable');
    }
  }

  @Get()
  list() { return this.fwd('GET', '/api/jobs/'); }

  @Get('stats')
  stats() { return this.fwd('GET', '/api/jobs/stats'); }

  @Get('wishlist')
  wishlist() { return this.fwd('GET', '/api/jobs/'); }

  @Post('scan')
  scan(@Body() body: { keywords?: string; limit?: number }) {
    return this.fwd('POST', '/api/scanner/run', {
      keywords: body.keywords ? body.keywords.split(' ') : ['data analytics intern engineer'],
      limit_per_query: body.limit || 15,
      auto_pipeline: false,
    });
  }

  @Post('digest')
  digest() { return this.fwd('POST', '/api/scanner/run', { auto_pipeline: true }); }

  @Post('ats')
  ats(@Body() body: { jd: string }) {
    return this.fwd('POST', '/api/jobs/ats-check', { jd_text: body.jd });
  }

  @Post('generate')
  generate(@Body() body: { company: string; jd: string; missing: any[] }) {
    return this.fwd('POST', '/api/jobs/generate-cv', body);
  }

  @Post('add')
  add(@Body() body: any) {
    return this.fwd('POST', '/api/jobs/', body);
  }

  @Post(':id/prepare')
  prepare(@Param('id') id: string) {
    return this.fwd('POST', `/api/jobs/${id}/ats`, {});
  }

  @Post(':id/apply')
  apply(@Param('id') id: string) {
    return this.fwd('POST', `/api/jobs/${id}/apply`, {});
  }

  @Post(':id/fill')
  fill(@Param('id') id: string) {
    return this.fwd('POST', `/api/jobs/${id}/generate-cv`, {});
  }

  @Post(':id/contact')
  contact(@Param('id') id: string) {
    return this.fwd('POST', `/api/jobs/${id}/apply`, { dry_run: true });
  }

  @Post('wishlist')
  updateWishlist(@Body() body: { action: string; name: string }) {
    return this.fwd('POST', '/api/jobs/pipeline', body);
  }
}
