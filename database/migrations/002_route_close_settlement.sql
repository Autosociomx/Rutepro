-- Route close settlement refinement.
-- Card/transfer/wallet revenue must never be reconciled as physical cash.

alter table if exists cx.route_closes
  add column if not exists cash_sales_cents bigint not null default 0,
  add column if not exists non_cash_sales_cents bigint not null default 0;

comment on column cx.route_closes.cash_sales_cents is 'Physical cash sales before route-paid cash expenses.';
comment on column cx.route_closes.non_cash_sales_cents is 'Card, transfer and wallet sales settled outside physical route cash.';
