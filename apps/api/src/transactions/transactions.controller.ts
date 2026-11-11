import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import {
  CreateTransactionDto,
  ListTransactionsQuery,
  SummaryQuery,
  UpdateTransactionDto,
} from './transactions.dto.js';
import { TransactionsService } from './transactions.service.js';

@UseGuards(AuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Query() query: ListTransactionsQuery) {
    return this.transactions.list(query);
  }

  /** Tudo que os cards e gráficos precisam numa ida só. */
  @Get('summary')
  summary(@Query() query: SummaryQuery) {
    return this.transactions.summary(query);
  }

  /** Fechamento dia a dia (saldo acumulado ao fim de cada dia com movimento). */
  @Get('balance-history')
  balanceHistory(@Query() query: SummaryQuery) {
    return this.transactions.balanceHistory(query);
  }

  /** Planilha .xlsx com os lançamentos dos filtros informados (mesmos filtros da lista). */
  @Get('export')
  async export(@Query() query: ListTransactionsQuery, @Res() res: Response) {
    await this.transactions.exportXlsx(query, res);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto, @Req() req: AuthedRequest) {
    return this.transactions.create(dto, req.user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @Req() req: AuthedRequest) {
    return this.transactions.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.transactions.remove(id, req.user.sub);
  }
}
