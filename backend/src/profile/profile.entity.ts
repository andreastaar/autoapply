import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  headline: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  linkedin: string;

  @Column({ nullable: true })
  github: string;

  @Column({ nullable: true })
  portfolio: string;

  @Column({ type: 'text', nullable: true })
  skills: string;

  @Column({ type: 'text', nullable: true })
  experience: string;

  @Column({ type: 'text', nullable: true })
  education: string;

  @Column({ type: 'text', nullable: true })
  personalStatement: string;

  // LinkedIn automation credentials
  @Column({ nullable: true })
  linkedinCookie: string;

  @Column({ nullable: true })
  linkedinJsessionid: string;

  // Job search preferences
  @Column({ type: 'text', nullable: true })
  jobKeywords: string;

  @Column({ nullable: true })
  targetLocation: string;

  @Column({ type: 'text', nullable: true })
  targetCompanies: string;

  // Work authorization (OPT/CPT)
  @Column({ nullable: true })
  workAuthorization: string; // 'opt', 'cpt', 'h1b', 'citizen', 'green_card', 'other'

  @Column({ nullable: true })
  optStartDate: string;

  @Column({ nullable: true })
  optExpiryDate: string;

  @Column({ nullable: true })
  cptStartDate: string;

  @Column({ nullable: true })
  cptExpiryDate: string;

  @Column({ default: false })
  needsSponsorship: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
