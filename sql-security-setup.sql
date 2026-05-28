-- crm_users 테이블 생성 + 비밀번호 해시 삽입
CREATE TABLE IF NOT EXISTS crm_users (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','exec','ops')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson1', '$2b$10$OuGrYAsa9InT8fx8OJZDlez12X.yu/6OwD2o6PR9HKrSW81R9I03K', '김정후', '본부장', 'admin') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson2', '$2b$10$OIdkwWuJQPzR/Ppl3cz/bO94GYxPUlpkcVGEK6fX6j0xCbnEaQn4G', '김창완', '팀장', 'admin') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson3', '$2b$10$YS8Jnw.OTwu8sm0v0Azv/uGVM2cKgv4Ex/XtboxvrWxT1OIhYeVqG', '최웅', '파트장', 'admin') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson4', '$2b$10$fOmZ5aYfiA33cHiHVcMw0eMSbjeOVrdTTnbv7Gb7Iki1MvzJjb.Iq', '조계현', '어쏘', 'exec') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson5', '$2b$10$GO0tPA2ljHQlpwu7c0qCE.eZknDnbe1OFzy3d7QUVw8KSkeq4gMwq', '이세호', '어쏘', 'exec') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson6', '$2b$10$YSfGXRAIirepDiFZ97wx6eCi8ngoL8QfHo3M97Pq54n8xjHSMoreC', '기여운', '어쏘', 'exec') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson7', '$2b$10$g/BujLXzMQFTN4FxSODeT.16Iffd3YEpsyQGtza10/vKLLyaMiSh6', '최연전', 'CX', 'exec') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson8', '$2b$10$Ko6xFGYBqMIoj9S4NZZgwesp8vU9eJu4D0N/SAuUIzW3jJQcKc6y.', '김재영', '어시', 'ops') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;
INSERT INTO crm_users (id, password_hash, name, title, role) VALUES ('adperson9', '$2b$10$siwtkZ2.ZBBSXteaa0paJ.IivcBIRSWCY4qsTMxgmuP5ky5uhqQGy', '최은정', '어시', 'ops') ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, title=EXCLUDED.title, role=EXCLUDED.role;

-- 세션 테이블에 만료 컬럼 추가
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- 기존 세션 24시간 만료 설정
UPDATE sessions SET expires_at = logged_in_at + INTERVAL '24 hours' WHERE expires_at IS NULL;

-- RLS: crm_users 읽기 전용
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_users_read" ON crm_users FOR SELECT USING (true);
