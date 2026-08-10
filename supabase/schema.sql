create table if not exists products (
  external_id text primary key,
  organization_id text not null,
  amazon_account text not null,
  marketplace text not null,
  sku text not null,
  asin text,
  product_name text not null,
  category text,
  lifecycle_status text default 'planning',
  owner text,
  remark text,
  updated_at timestamptz default now()
);

create table if not exists cost_components (
  external_id text primary key,
  sku text not null,
  currency text default 'CNY',
  purchase_cost numeric default 0,
  packaging_cost numeric default 0,
  inspection_cost numeric default 0,
  domestic_shipping numeric default 0,
  first_leg_shipping numeric default 0,
  tariff_rate numeric default 0,
  other_cost numeric default 0,
  landed_cost numeric default 0,
  effective_date date,
  updated_at timestamptz default now()
);

create table if not exists pre_launch_calculations (
  external_id text primary key,
  sku text not null,
  target_price numeric default 0,
  estimated_referral_fee numeric default 0,
  estimated_fba_fee numeric default 0,
  estimated_acos numeric default 0,
  estimated_return_rate numeric default 0,
  coupon_cost numeric default 0,
  estimated_net_margin numeric default 0,
  estimated_roi numeric default 0,
  launch_decision text default 'review',
  updated_at timestamptz default now()
);

create table if not exists suppliers (
  external_id text primary key,
  supplier_name text not null,
  contact text,
  phone text,
  product_line text,
  moq numeric default 0,
  lead_time_days numeric default 0,
  payment_terms text,
  remark text,
  updated_at timestamptz default now()
);

create table if not exists competitor_research (
  external_id text primary key,
  sku text not null,
  competitor_asin text not null,
  competitor_price numeric default 0,
  review_count numeric default 0,
  rating numeric default 0,
  bsr numeric default 0,
  pain_points text,
  opportunity text,
  research_date date,
  updated_at timestamptz default now()
);

create table if not exists operation_logs (
  external_id text primary key,
  sku text not null,
  date date,
  action_type text not null,
  owner text,
  note text,
  status text default 'todo',
  updated_at timestamptz default now()
);

alter table products enable row level security;
alter table cost_components enable row level security;
alter table pre_launch_calculations enable row level security;
alter table suppliers enable row level security;
alter table competitor_research enable row level security;
alter table operation_logs enable row level security;

