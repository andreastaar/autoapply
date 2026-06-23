import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { ApplicationsModule } from './applications/applications.module';
import { LinkedinModule } from './linkedin/linkedin.module';
import { OutreachModule } from './outreach/outreach.module';
import { User } from './users/user.entity';
import { Profile } from './profile/profile.entity';
import { Opportunity } from './opportunities/opportunity.entity';
import { Application } from './applications/application.entity';
import { Outreach } from './outreach/outreach.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'autoapply',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME || 'autoapply',
      entities: [User, Profile, Opportunity, Application, Outreach],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    ProfileModule,
    OpportunitiesModule,
    ApplicationsModule,
    LinkedinModule,
    OutreachModule,
  ],
})
export class AppModule {}
