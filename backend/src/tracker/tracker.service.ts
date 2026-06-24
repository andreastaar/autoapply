import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackerEntry } from './tracker.entity';

@Injectable()
export class TrackerService {
  constructor(@InjectRepository(TrackerEntry) private repo: Repository<TrackerEntry>) {}

  async findByUser(userId: string) {
    const entries = await this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });
    return entries.map((e, i) => ({
      ...e,
      number: String(i + 1).padStart(3, '0'),
      date: e.createdAt.toISOString().split('T')[0],
      score: e.score ? Number(e.score) : null,
      report: e.reportContent ? { path: e.reportFilename || e.id, content: e.reportContent } : null,
    }));
  }

  async create(userId: string, data: Partial<TrackerEntry>) {
    const entry = this.repo.create({ ...data, user: { id: userId } as any });
    return this.repo.save(entry);
  }

  async updateStatus(id: string, userId: string, status: string) {
    await this.repo.update({ id, user: { id: userId } as any }, { status });
    return { ok: true };
  }

  async addReport(id: string, userId: string, content: string, filename: string) {
    await this.repo.update({ id, user: { id: userId } as any }, { reportContent: content, reportFilename: filename });
    return { ok: true };
  }

  async getStats(userId: string) {
    const entries = await this.repo.find({ where: { user: { id: userId } } });
    const byStatus: Record<string, number> = {};
    let scoreSum = 0, scoreCount = 0;
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      if (e.score) { scoreSum += Number(e.score); scoreCount++; }
    }
    return {
      total: entries.length,
      avgScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
      byStatus,
    };
  }
}
