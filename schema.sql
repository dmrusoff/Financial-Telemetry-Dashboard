-- 1. Credit Cards Table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  issuer TEXT NOT NULL,
  name TEXT NOT NULL,
  credit_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  payment_due NUMERIC DEFAULT 0,
  due_date DATE,
  closing_day INTEGER DEFAULT 15,
  grace_days INTEGER DEFAULT 25,
  paid BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  plaid_account_id TEXT,
  last_plaid_sync TIMESTAMPTZ
);

-- 2. Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT DEFAULT 'Monthly',
  amount NUMERIC DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  due_date DATE,
  source TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 3. Banking Accounts Table
CREATE TABLE IF NOT EXISTS banking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  bank TEXT NOT NULL,
  name TEXT NOT NULL,
  account TEXT,
  balance NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  plaid_account_id TEXT,
  last_plaid_sync TIMESTAMPTZ
);

-- 4. Investments Table
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  type TEXT NOT NULL,
  brokerage TEXT NOT NULL,
  account TEXT,
  balance NUMERIC DEFAULT 0,
  interest_accrued NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  plaid_account_id TEXT,
  last_plaid_sync TIMESTAMPTZ
);

-- 5. Income Streams Table
CREATE TABLE IF NOT EXISTS income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- 6. Dashboard Metadata Table
CREATE TABLE IF NOT EXISTS dashboard_metadata (
  key TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metadata ENABLE ROW LEVEL SECURITY;
