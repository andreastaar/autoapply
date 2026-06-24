import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';

@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Report) private repo: Repository<Report>) {}

  async findByUser(userId: string) {
    const reports = await this.repo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' },
    });
    return reports.map((r, i) => ({
      id: String(reports.length - i).padStart(3, '0'),
      filename: r.filename,
      slug: r.slug,
      date: r.date || r.createdAt.toISOString().split('T')[0],
      dbId: r.id,
    }));
  }

  async getByFilename(userId: string, filename: string) {
    const report = await this.repo.findOne({ where: { filename, user: { id: userId } as any } });
    if (!report) return null;
    return { filename: report.filename, content: report.content };
  }

  async getById(userId: string, id: string) {
    const report = await this.repo.findOne({ where: { id, user: { id: userId } as any } });
    if (!report) return null;
    return { filename: report.filename, content: report.content };
  }

  async create(userId: string, filename: string, slug: string, content: string, date?: string) {
    const report = this.repo.create({ filename, slug, content, date, user: { id: userId } as any });
    return this.repo.save(report);
  }
}
