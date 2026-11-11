import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { InvitesModule } from './invites/invites.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [DbModule, AuthModule, CategoriesModule, TransactionsModule, InvitesModule],
  controllers: [HealthController],
})
export class AppModule {}
