begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select ok(true, 'pgTAP runs');
select * from finish();
rollback;
