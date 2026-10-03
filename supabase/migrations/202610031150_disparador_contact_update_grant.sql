-- Disparador (QA Q9): telefone e igreja do contato são a identidade do opt-out e não podem ser trocados
-- pelo cliente (senão: renomeia o número que saiu e recadastra o original com opt-in).
-- UPDATE pelo cliente só nas colunas editáveis; o motor (service_role) mantém acesso total.

revoke update on disparador.contacts from authenticated;
grant update (name, opted_in_at, opted_out_at, source) on disparador.contacts to authenticated;
