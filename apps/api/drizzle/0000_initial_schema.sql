-- pg_trgm: busca por "contém" na descrição usa índice GIN (transactions_description_trgm_idx).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('criado', 'alterado', 'excluido');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'dinheiro', 'cartao-credito', 'cartao-debito');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"color" text DEFAULT '#7d8790' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_totals" (
	"day" date NOT NULL,
	"category_id" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"type" "transaction_type" NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_totals_day_category_id_payment_method_pk" PRIMARY KEY("day","category_id","payment_method")
);
--> statement-breakpoint
CREATE TABLE "transaction_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"user_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category_id" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"occurred_on" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_totals" ADD CONSTRAINT "daily_totals_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_audit" ADD CONSTRAINT "transaction_audit_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_audit" ADD CONSTRAINT "transaction_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_type_name_lower_idx" ON "categories" USING btree ("type",lower("name"));--> statement-breakpoint
CREATE INDEX "daily_totals_category_day_idx" ON "daily_totals" USING btree ("category_id","day");--> statement-breakpoint
CREATE INDEX "transaction_audit_transaction_idx" ON "transaction_audit" USING btree ("transaction_id","at");--> statement-breakpoint
CREATE INDEX "transaction_audit_user_idx" ON "transaction_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_occurred_idx" ON "transactions" USING btree ("occurred_on","id") WHERE "transactions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transactions_category_occurred_idx" ON "transactions" USING btree ("category_id","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_method_occurred_idx" ON "transactions" USING btree ("payment_method","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_created_by_idx" ON "transactions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "transactions_description_trgm_idx" ON "transactions" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));