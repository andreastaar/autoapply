import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineItem } from './pipeline.entity';

@Injectable()
export class PipelineService {
  constructor(@InjectRepository(PipelineItem) private repo: Repository<PipelineItem>) {}

  async getByUser(userId: string) {
    const items = await this.repo.find({
      where: { user: { id: userId } as any },
      order: { addedAt: 'DESC' },
    });
    return {
      pending: items.filter(i => i.status === 'pending'),
      done: items.filter(i => i.status === 'done'),
    };
  }

  async add(userId: string, url: string, company?: string, role?: string) {
    const existing = await this.repo.findOne({ where: { url, user: { id: userId } as any } });
    if (existing) return existing;
    const item = this.repo.create({ url, company, role, user: { id: userId } as any });
    return this.repo.save(item);
  }

  async remove(userId: string, url: string) {
    await this.repo.delete({ url, user: { id: userId } as any });
    return { ok: true };
  }

  async markDone(userId: string, url: string) {
    await this.repo.update({ url, user: { id: userId } as any }, { status: 'done' });
    return { ok: true };
  }

  async getPendingCount(userId: string) {
    return this.repo.count({ where: { status: 'pending', user: { id: userId } as any } });
  }
}
