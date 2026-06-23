import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity, OpportunityType } from './opportunity.entity';

@Injectable()
export class OpportunitiesService {
  constructor(@InjectRepository(Opportunity) private repo: Repository<Opportunity>) {}

  async findAll(type?: OpportunityType) {
    const where: any = { isActive: true };
    if (type) where.type = type;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Partial<Opportunity>) {
    return this.repo.save(this.repo.create(data));
  }

  async importFromLinkedin(jobs: any[]) {
    const results = [];
    for (const job of jobs) {
      const existing = await this.repo.findOne({ where: { title: job.title, organization: job.company || job.companyName } });
      if (existing) continue;
      results.push(await this.repo.save(this.repo.create({
        title: job.title,
        organization: job.company || job.companyName || 'Unknown',
        type: OpportunityType.JOB,
        location: job.location || '',
        country: '',
        description: job.description || '',
        deadline: 'Open',
        applyUrl: job.url || job.applyUrl || '',
        isActive: true,
      })));
    }
    return results;
  }

  async seed() {
    const count = await this.repo.count();
    if (count > 0) return;
    await this.repo.save([
      // Jobs
      { title: 'Software Engineer Intern', organization: 'Google', type: OpportunityType.INTERNSHIP, location: 'Remote', country: 'USA', description: 'Join Google as a software engineering intern.', deadline: '2026-08-01', applyUrl: 'https://careers.google.com' },
      { title: 'Junior Backend Developer', organization: 'Stripe', type: OpportunityType.JOB, location: 'Remote', country: 'USA', description: 'Backend developer role at Stripe.', deadline: 'Open', applyUrl: 'https://stripe.com/jobs' },
      { title: 'AI/ML Internship', organization: 'Apple', type: OpportunityType.INTERNSHIP, location: 'Cupertino, CA', country: 'USA', description: 'Machine Learning and AI internship at Apple.', deadline: '2026-09-01', applyUrl: 'https://jobs.apple.com' },
      { title: 'Data Science Intern', organization: 'Meta', type: OpportunityType.INTERNSHIP, location: 'Remote', country: 'USA', description: 'Data Science internship at Meta.', deadline: '2026-08-15', applyUrl: 'https://metacareers.com' },
      // Becas from BECAS MCP
      { title: 'MIT Summer Research Program', organization: 'MIT', type: OpportunityType.PROGRAMME, location: 'Cambridge, MA', country: 'USA', description: 'Fully funded undergraduate research at MIT. Covers travel, housing, and stipend.', deadline: '2026-03-01', applyUrl: 'https://oge.mit.edu/msrp/' },
      { title: 'Yale Big Data Summer Institute', organization: 'Yale University', type: OpportunityType.PROGRAMME, location: 'New Haven, CT', country: 'USA', description: 'Fully funded research in big data and biostatistics at Yale.', deadline: '2026-02-28', applyUrl: 'https://publichealth.yale.edu/bdsy/' },
      { title: 'Harvard Pre-College Program', organization: 'Harvard University', type: OpportunityType.PROGRAMME, location: 'Cambridge, MA', country: 'USA', description: 'Residential pre-college experience at Harvard. Limited scholarships available.', deadline: '2026-04-01', applyUrl: 'https://summer.harvard.edu/high-school-programs/pre-college-program/' },
      { title: 'Chevening Scholarship', organization: 'UK Government', type: OpportunityType.SCHOLARSHIP, location: 'United Kingdom', country: 'UK', description: 'Full scholarship for outstanding emerging leaders from around the world.', deadline: '2026-11-05', applyUrl: 'https://chevening.org' },
      { title: 'CIVICA Summer University', organization: 'CIVICA', type: OpportunityType.PROGRAMME, location: 'Europe', country: 'Europe', description: 'European interdisciplinary summer school across top universities.', deadline: '2026-04-15', applyUrl: 'https://civica.eu/summer-university/' },
      { title: 'ESCP International Summer School', organization: 'ESCP Business School', type: OpportunityType.PROGRAMME, location: 'Paris, France', country: 'France', description: 'International summer school at ESCP covering business and management.', deadline: '2026-05-01', applyUrl: 'https://escp.eu/programmes/international-summer-school' },
      { title: 'Tsinghua Summer Program', organization: 'Tsinghua University', type: OpportunityType.PROGRAMME, location: 'Beijing, China', country: 'China', description: 'Summer academic program at one of China\'s top universities.', deadline: '2026-04-30', applyUrl: 'https://www.tsinghua.edu.cn/en/' },
      { title: 'HKU Summer Institute', organization: 'University of Hong Kong', type: OpportunityType.PROGRAMME, location: 'Hong Kong', country: 'Hong Kong', description: 'Intensive summer courses at HKU covering various disciplines.', deadline: '2026-04-01', applyUrl: 'https://summerinstitute.hku.hk/' },
      { title: 'NUS Summer Workshop', organization: 'National University of Singapore', type: OpportunityType.PROGRAMME, location: 'Singapore', country: 'Singapore', description: 'Summer workshops and research programs at NUS.', deadline: '2026-03-31', applyUrl: 'https://nus.edu.sg/cfg/students/workshops-programmes' },
    ]);
  }
}
