import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outreach, OutreachStatus, OutreachType } from './outreach.entity';

@Injectable()
export class OutreachService {
  constructor(@InjectRepository(Outreach) private repo: Repository<Outreach>) {}

  findByUser(userId: string) {
    return this.repo.find({
      where: { user: { id: userId } },
      order: { sentAt: 'DESC' },
    });
  }

  create(userId: string, data: Partial<Outreach>) {
    return this.repo.save(this.repo.create({ ...data, user: { id: userId } as any }));
  }

  async updateStatus(id: string, userId: string, status: OutreachStatus) {
    await this.repo.update({ id, user: { id: userId } }, { status });
    return this.repo.findOne({ where: { id } });
  }

  stats(userId: string) {
    return this.repo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.userId = :userId', { userId })
      .groupBy('o.status')
      .getRawMany();
  }
}
