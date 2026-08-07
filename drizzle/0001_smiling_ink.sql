CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"accion" text NOT NULL,
	"entidad_tipo" text NOT NULL,
	"entidad_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"motivo" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cargas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"player_ref" text NOT NULL,
	"monto_cents" bigint NOT NULL,
	"moneda" text DEFAULT 'ARS' NOT NULL,
	"metodo" text NOT NULL,
	"origen" text NOT NULL,
	"estado" text DEFAULT 'pending' NOT NULL,
	"external_ref" text,
	"comprobante_url" text,
	"motivo_rechazo" text,
	"registrada_por" uuid NOT NULL,
	"validada_por" uuid,
	"rechazada_por" uuid,
	"asentada_por" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operacion_tipo" text NOT NULL,
	"operacion_id" text NOT NULL,
	"cuenta" text NOT NULL,
	"tipo" text NOT NULL,
	"monto_cents" bigint NOT NULL,
	"moneda" text DEFAULT 'ARS' NOT NULL,
	"descripcion" text NOT NULL,
	"asiento_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_registrada_por_profiles_id_fk" FOREIGN KEY ("registrada_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_validada_por_profiles_id_fk" FOREIGN KEY ("validada_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_rechazada_por_profiles_id_fk" FOREIGN KEY ("rechazada_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_asentada_por_profiles_id_fk" FOREIGN KEY ("asentada_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tenant_created_at_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_tenant_entidad_idx" ON "audit_log" USING btree ("tenant_id","entidad_tipo","entidad_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "cargas_tenant_estado_idx" ON "cargas" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "cargas_tenant_created_at_idx" ON "cargas" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cargas_tenant_external_ref_idx" ON "cargas" USING btree ("tenant_id","external_ref") WHERE "cargas"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ledger_tenant_operacion_idx" ON "ledger_entries" USING btree ("tenant_id","operacion_tipo","operacion_id");--> statement-breakpoint
CREATE INDEX "ledger_tenant_asiento_idx" ON "ledger_entries" USING btree ("tenant_id","asiento_id");--> statement-breakpoint
CREATE INDEX "ledger_tenant_created_at_idx" ON "ledger_entries" USING btree ("tenant_id","created_at");