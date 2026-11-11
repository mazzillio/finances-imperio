-- Remove a forma de pagamento: o clube só registra entrada/saída por categoria.
DROP INDEX "transactions_method_occurred_idx";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "payment_method";--> statement-breakpoint

-- daily_totals tinha uma linha por (dia, categoria, forma de pagamento). Sem a forma de pagamento,
-- as linhas do mesmo dia/categoria precisam virar uma só: refaz o resumo a partir dos lançamentos
-- ativos (a fonte da verdade) em vez de tentar juntar as linhas antigas.
ALTER TABLE "daily_totals" DROP CONSTRAINT "daily_totals_day_category_id_payment_method_pk";--> statement-breakpoint
TRUNCATE TABLE "daily_totals";--> statement-breakpoint
ALTER TABLE "daily_totals" DROP COLUMN "payment_method";--> statement-breakpoint
ALTER TABLE "daily_totals" ADD CONSTRAINT "daily_totals_day_category_id_pk" PRIMARY KEY("day","category_id");--> statement-breakpoint
INSERT INTO "daily_totals" ("day", "category_id", "type", "total_cents", "count")
SELECT "occurred_on", "category_id", "type", sum("amount_cents")::bigint, count(*)::int
FROM "transactions"
WHERE "deleted_at" IS NULL
GROUP BY "occurred_on", "category_id", "type";--> statement-breakpoint

-- O histórico guarda cópias dos lançamentos em JSON: tira a forma de pagamento delas também.
UPDATE "transaction_audit"
SET "before" = "before" - 'paymentMethod', "after" = "after" - 'paymentMethod'
WHERE "before" ? 'paymentMethod' OR "after" ? 'paymentMethod';--> statement-breakpoint

DROP TYPE "public"."payment_method";
