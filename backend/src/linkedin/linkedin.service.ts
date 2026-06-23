import { Injectable, BadRequestException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);
const CLI = '/usr/local/bin/linkedin';

@Injectable()
export class LinkedinService {
  private async run(liAt: string, jsessionid: string, args: string[]): Promise<any> {
    if (!liAt || !jsessionid) {
      throw new BadRequestException('LinkedIn credentials not set. Go to Profile and add your li_at and JSESSIONID cookies.');
    }
    try {
      const { stdout } = await exec(CLI, args, {
        env: {
          ...process.env,
          LINKEDIN_LI_AT: liAt,
          LINKEDIN_JSESSIONID: jsessionid,
        },
        timeout: 20000,
      });
      return JSON.parse(stdout);
    } catch (err: any) {
      const msg = err.stdout ? JSON.parse(err.stdout)?.error : err.message;
      throw new BadRequestException(msg || 'LinkedIn request failed');
    }
  }

  async searchJobs(liAt: string, jsessionid: string, keywords: string, location?: string, remote?: boolean, limit = 10) {
    const args = ['search', 'jobs', '--keywords', keywords, '--limit', String(limit)];
    if (location) args.push('--location', location);
    if (remote) args.push('--remote');
    return this.run(liAt, jsessionid, args);
  }

  async searchPeople(liAt: string, jsessionid: string, keywords: string, company?: string, title?: string, limit = 10) {
    const args = ['search', 'people', '--keywords', keywords, '--limit', String(limit)];
    if (company) args.push('--company', company);
    if (title) args.push('--title', title);
    return this.run(liAt, jsessionid, args);
  }

  async sendConnection(liAt: string, jsessionid: string, profileUrn: string, message?: string) {
    const args = ['connections', 'send', profileUrn];
    if (message) args.push('--message', message);
    return this.run(liAt, jsessionid, args);
  }

  async sendMessage(liAt: string, jsessionid: string, profileUrns: string[], message: string) {
    const args = ['messaging', 'send-new', '--recipients', profileUrns.join(','), '--message', message];
    return this.run(liAt, jsessionid, args);
  }

  async viewJob(liAt: string, jsessionid: string, jobId: string) {
    return this.run(liAt, jsessionid, ['jobs', 'view', jobId]);
  }

  async getProfile(liAt: string, jsessionid: string) {
    return this.run(liAt, jsessionid, ['profile', 'view']);
  }
}
