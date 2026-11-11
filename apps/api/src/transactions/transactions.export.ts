import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type { TransactionType } from '../common/money.js';
import type { ListTransactionsQuery } from './transactions.dto.js';

interface ExportRow {
  type: TransactionType;
  categoryName: string;
  amountCents: number;
  description: string;
  occurredOn: string;
  createdByName: string;
  createdAt: Date;
}

const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const GOLD = 'FFE0B050';
const INK = 'FF141004';

/** Data "AAAA-MM-DD" como data do Excel, sem deslocar o dia por causa do fuso. */
const excelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** O Excel não tem fuso: grava a hora já no horário de Brasília. */
const excelLocal = (d: Date) => new Date(d.getTime() - 3 * 60 * 60 * 1000);

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: INK } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

/**
 * Escreve a planilha em streaming (WorkbookWriter): cada linha vai para a resposta e sai da memória.
 * Aba "Lançamentos" com todas as linhas e aba "Resumo" com totais por categoria,
 * somados durante a própria leitura, então respeitam todos os filtros (inclusive a busca por texto).
 */
export async function writeTransactionsXlsx(
  res: Response,
  filters: Omit<ListTransactionsQuery, 'limit' | 'cursor'>,
  batches: AsyncIterable<ExportRow[]>,
) {
  const iterator = batches[Symbol.asyncIterator]();
  // Primeiro lote antes dos cabeçalhos: se a consulta falhar, ainda dá para responder com erro JSON.
  let next = await iterator.next();

  const period = [filters.from, filters.to].filter(Boolean).join('_a_') || 'todos';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="lancamentos_${period}.xlsx"`);
  res.setHeader('Cache-Control', 'no-store');

  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
  wb.creator = 'Império Poker · Finanças';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Lançamentos', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Descrição', key: 'description', width: 44 },
    { header: 'Valor', key: 'amount', width: 16, style: { numFmt: BRL } },
    { header: 'Lançado por', key: 'author', width: 18 },
    { header: 'Lançado em', key: 'createdAt', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  ];
  styleHeader(sheet.getRow(1));
  sheet.getRow(1).commit();

  let count = 0;
  let inCents = 0;
  let outCents = 0;
  const byCategory = new Map<string, { type: TransactionType; name: string; cents: number; count: number }>();

  while (!next.done) {
    for (const t of next.value) {
      const isIn = t.type === 'entrada';
      sheet
        .addRow({
          date: excelDate(t.occurredOn),
          type: isIn ? 'Entrada' : 'Saída',
          category: t.categoryName,
          description: t.description,
          amount: (isIn ? t.amountCents : -t.amountCents) / 100,
          author: t.createdByName,
          createdAt: excelLocal(t.createdAt),
        })
        .commit();

      count++;
      if (isIn) inCents += t.amountCents;
      else outCents += t.amountCents;
      const catKey = `${t.type}|${t.categoryName}`;
      const cat = byCategory.get(catKey) ?? { type: t.type, name: t.categoryName, cents: 0, count: 0 };
      cat.cents += t.amountCents;
      cat.count++;
      byCategory.set(catKey, cat);
    }
    next = await iterator.next();
  }
  sheet.autoFilter = { from: 'A1', to: 'G1' };
  sheet.commit();

  const summary = wb.addWorksheet('Resumo');
  summary.columns = [
    { key: 'a', width: 26 },
    { key: 'b', width: 18 },
    { key: 'c', width: 18 },
    { key: 'd', width: 18 },
  ];
  const add = (values: unknown[], opts: { header?: boolean; bold?: boolean; money?: number[] } = {}) => {
    const row = summary.addRow(values);
    if (opts.header) styleHeader(row);
    if (opts.bold) row.font = { bold: true };
    for (const col of opts.money ?? []) row.getCell(col).numFmt = BRL;
    row.commit();
  };
  const fmtDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');

  add(['Império Poker · Finanças'], { bold: true });
  add(['Período', `${fmtDate(filters.from)} a ${fmtDate(filters.to)}`]);
  add(['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })]);
  add([]);
  add(['Totais', 'Valor'], { header: true });
  add(['Entradas', inCents / 100], { money: [2] });
  add(['Saídas', -outCents / 100], { money: [2] });
  add(['Saldo', (inCents - outCents) / 100], { bold: true, money: [2] });
  add(['Lançamentos', count]);
  add([]);

  add(['Por categoria', 'Tipo', 'Lançamentos', 'Valor'], { header: true });
  const cats = [...byCategory.values()].sort((a, b) => (a.type === b.type ? b.cents - a.cents : a.type === 'entrada' ? -1 : 1));
  for (const c of cats) {
    add([c.name, c.type === 'entrada' ? 'Entrada' : 'Saída', c.count, (c.type === 'entrada' ? c.cents : -c.cents) / 100], {
      money: [4],
    });
  }
  summary.commit();

  await wb.commit();
}
