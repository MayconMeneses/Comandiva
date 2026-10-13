-- order_change_logs / order_status_history nunca são alterados nem apagados
-- em nenhum lugar do código (só INSERT) — isso hoje é só convenção. Estes
-- triggers tornam isso uma trava real do MySQL: mesmo uma query manual ou um
-- bug futuro que tentasse UPDATE/DELETE nessas tabelas é rejeitado pelo
-- próprio banco, não só pela ausência de código que faça isso.
CREATE TRIGGER order_change_logs_no_update
BEFORE UPDATE ON order_change_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_change_logs é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER order_change_logs_no_delete
BEFORE DELETE ON order_change_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_change_logs é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER order_status_history_no_update
BEFORE UPDATE ON order_status_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_status_history é somente-leitura após criado (append-only).';
END;
--> statement-breakpoint
CREATE TRIGGER order_status_history_no_delete
BEFORE DELETE ON order_status_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_status_history é somente-leitura após criado (append-only).';
END;
