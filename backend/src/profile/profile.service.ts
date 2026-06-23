import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './profile.entity';

@Injectable()
export class ProfileService {
  constructor(@InjectRepository(Profile) private repo: Repository<Profile>) {}

  async findByUser(userId: string) {
    return this.repo.findOne({ where: { user: { id: userId } } });
  }

  async upsert(userId: string, data: Partial<Profile>) {
    let profile = await this.findByUser(userId);
    if (!profile) {
      profile = this.repo.create({ user: { id: userId } as any, ...data });
    } else {
      Object.assign(profile, data);
    }
    return this.repo.save(profile);
  }
}
