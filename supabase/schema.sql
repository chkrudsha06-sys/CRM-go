-- 분양회 CRM Schema
-- Supabase SQL Editor에 붙여넣어 실행하세요

-- 연락처 (고객) 테이블
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  customer_type TEXT DEFAULT '신규' CHECK (customer_type IN ('신규', '기고객')),
  consultant TEXT,
  has_tm BOOLEAN DEFAULT FALSE,
  tm_date DATE,
  tm_sensitivity TEXT CHECK (tm_sensitivity IN ('상', '중', '하')),
  prospect_type TEXT CHECK (prospect_type IN ('미팅예정가망', '즉가입가망', '연계매출가망고객')),
  meeting_date DATE,
  meeting_address TEXT,
  memo TEXT,
  meeting_result TEXT CHECK (meeting_result IN ('계약완료', '예약완료', '서류만수취', '미팅후가망관리', '계약거부', '미팅불발')),
  contract_date DATE,
  assigned_to TEXT NOT NULL CHECK (assigned_to IN ('조계현', '이세호', '기여운', '최연전')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 월간 목표 테이블
CREATE TABLE IF NOT EXISTS monthly_goals (
  id BIGSERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  member_name TEXT NOT NULL,
  target_contracts INT DEFAULT 4,
  target_revenue BIGINT DEFAULT 20000000,
  UNIQUE(year, month, member_name)
);

-- 활동 로그 테이블 (히스토리 추적용)
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  member_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 기본 월간 목표 데이터 (2026년 4월)
INSERT INTO monthly_goals (year, month, member_name, target_contracts, target_revenue) VALUES
  (2026, 4, '조계현', 4, 20000000),
  (2026, 4, '이세호', 4, 20000000),
  (2026, 4, '기여운', 4, 20000000),
  (2026, 4, '최연전', 4, 20000000)
ON CONFLICT (year, month, member_name) DO NOTHING;

-- Row Level Security (RLS) 설정 - 필요시 활성화
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_meeting_result ON contacts(meeting_result);
CREATE INDEX IF NOT EXISTS idx_contacts_prospect_type ON contacts(prospect_type);
CREATE INDEX IF NOT EXISTS idx_contacts_tm_date ON contacts(tm_date);
CREATE INDEX IF NOT EXISTS idx_contacts_meeting_date ON contacts(meeting_date);
