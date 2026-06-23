import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum OpportunityType {
  JOB = 'job',
  SCHOLARSHIP = 'scholarship',
  PROGRAMME = 'programme',
  INTERNSHIP = 'internship',
}

@Entity('opportunities')
export class Opportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  organization: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: OpportunityType, default: OpportunityType.JOB })
  type: OpportunityType;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  applyUrl: string;

  @Column({ nullable: true })
  deadline: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
