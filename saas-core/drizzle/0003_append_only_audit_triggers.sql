-- platform_audit_log / subscription_events nunca são alterados nem apagados
-- em nenhum lugar do código (só INSERT, ver saas-core/drizzle/schema/audit.ts)
-- — isso hoje é só convenção. Estes triggers tornam isso uma trava real do
-- MySQL: mesmo uma query manual ou um bug futuro que tentasse UPDATE/DELETE
-- nessas tabelas é rejeitado pelo próprio banco.
CREATE TRIGGER platform_audit_log_no_update
BEFORE UPDATE ON platform_audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'platform_audit_log é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER platform_audit_log_no_delete
BEFORE DELETE ON platform_audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'platform_audit_log é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER subscription_events_no_update
BEFORE UPDATE ON subscription_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription_events é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER subscription_events_no_delete
BEFORE DELETE ON subscription_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'subscription_events é somente-leitura após criado (append-only).';
END;
