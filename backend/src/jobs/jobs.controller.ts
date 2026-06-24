import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Request, UseGuards, Res, StreamableFile,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { firstValueFrom } from 'rxjs';

const AUTOPILOT = 'http://localhost:8800';

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
  list() { return this.fwd('GET', '/api/jobs'); }

  @Get('stats')
  stats() { return this.fwd('GET', '/api/jobs'); }

  @Get('wishlist')
  wishlist() { return this.fwd('GET', '/api/wishlist'); }

  @Post('scan')
  scan(@Body() body: { keywords?: string; limit?: number }) {
    return this.fwd('POST', '/api/scan', {
      keywords: body.keywords || 'data analytics intern engineer',
      limit: body.limit || 150,
    });
  }

  @Post('digest')
  digest() { return this.fwd('POST', '/api/digest', {}); }

  @Post('ats')
  ats(@Body() body: { jd: string }) {
    return this.fwd('POST', '/api/ats', { jd: body.jd });
  }

  @Post('generate')
  generate(@Body() body: { company: string; jd: string; missing: any[] }) {
    return this.fwd('POST', '/api/generate', body);
  }

  @Post('add')
  add(@Body() body: any) {
    return this.fwd('POST', '/api/jobs', body);
  }

  @Post(':id/prepare')
  prepare(@Param('id') id: string) {
    return this.fwd('POST', '/api/prepare', { id: parseInt(id) });
  }

  @Post(':id/apply')
  apply(@Param('id') id: string) {
    return this.fwd('POST', '/api/apply', { id: parseInt(id) });
  }

  @Post(':id/fill')
  fill(@Param('id') id: string) {
    return this.fwd('POST', '/api/fill', { id: parseInt(id) });
  }

  @Post(':id/contact')
  contact(@Param('id') id: string) {
    return this.fwd('POST', '/api/contact', { id: parseInt(id) });
  }

  @Post('wishlist')
  updateWishlist(@Body() body: { action: string; name: string }) {
    return this.fwd('POST', '/api/wishlist', body);
  }
}
