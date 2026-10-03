-- CNPJ: só dígitos, 14 caracteres, dígitos verificadores válidos. Dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is(public.is_valid_cnpj('11222333000181'), true, 'CNPJ válido aceite');
select is(public.is_valid_cnpj('11444777000161'), true, 'segundo CNPJ válido aceite');
select is(public.is_valid_cnpj('11222333000182'), false, 'dígito verificador errado rejeitado');
select is(public.is_valid_cnpj('11111111111111'), false, 'dígitos repetidos rejeitados');
select is(public.is_valid_cnpj('11.222.333/0001-81'), false, 'CNPJ com máscara rejeitado (guardar só dígitos)');

select lives_ok(
  $$ insert into public.tenants (name, cnpj, slug) values ('Igreja Teste A', '11222333000181', 'igreja-teste-a') $$,
  'tenant com CNPJ válido é criado');
select throws_ok(
  $$ insert into public.tenants (name, cnpj, slug) values ('Igreja Inválida', '11222333000182', 'igreja-invalida') $$,
  '23514', null,
  'tenant com CNPJ inválido é rejeitado (check constraint)');

select * from finish();
rollback;
