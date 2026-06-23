import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './application.entity';

@Injectable()
export class ApplicationsService {
  constructor(@InjectRepository(Application) private repo: Repository<Application>) {}

  findByUser(userId: string) {
    return this.repo.find({
      where: { user: { id: userId } },
      relations: ['opportunity'],
      order: { appliedAt: 'DESC' },
    });
  }

  apply(userId: string, opportunityId: string, notes?: string) {
    return this.repo.save(
      this.repo.create({
        user: { id: userId } as any,
        opportunity: { id: opportunityId } as any,
        notes,
        status: ApplicationStatus.SUBMITTED,
      }),
    );
  }

  async updateStatus(id: string, userId: string, status: ApplicationStatus) {
    await this.repo.update({ id, user: { id: userId } }, { status });
    return this.repo.findOne({ where: { id }, relations: ['opportunity'] });
  }
}
