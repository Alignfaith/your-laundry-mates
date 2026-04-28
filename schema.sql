CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email','phone')),
  dread_score INT CHECK (dread_score BETWEEN 1 AND 5),
  interest_level TEXT CHECK (interest_level IN ('YES_PLEASE','MAYBE_LATER')),
  frequency TEXT CHECK (frequency IN ('WEEKLY','BIWEEKLY','MONTHLY','AS_NEEDED')),
  notes TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, referrer TEXT,
  status TEXT DEFAULT 'NEW',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
