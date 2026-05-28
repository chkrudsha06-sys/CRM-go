# 분양회 CRM — 광고인㈜ 대외협력팀

> **분양회 VIP 100인 모집 영업관리 시스템**  
> 고객 DB 관리 · 파이프라인 추적 · 미팅 캘린더 · 성과 분석

---

## 🚀 배포 3단계 (총 소요 시간: 약 30분)

---

### STEP 1. Supabase 데이터베이스 설정 (10분)

#### 1-1. Supabase 프로젝트 생성
1. [https://supabase.com](https://supabase.com) 접속 → **Sign Up** (무료)
2. **New Project** 클릭
3. 프로젝트명: `bunyanghoe-crm`
4. DB 비밀번호 설정 (메모해두세요)
5. Region: **Northeast Asia (Seoul)** 선택
6. 생성 완료까지 약 1~2분 대기

#### 1-2. 테이블 생성
1. 좌측 메뉴 → **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용을 전체 복사
3. SQL Editor에 붙여넣기 → **Run** 클릭
4. ✅ 테이블 생성 완료 확인

#### 1-3. API 키 복사
1. 좌측 메뉴 → **Project Settings** → **API**
2. **Project URL** 복사 → `.env.local`에 저장
3. **anon public** 키 복사 → `.env.local`에 저장
4. **service_role secret** 키 복사 → `.env.local`에 저장 (데이터 임포트용)

---

### STEP 2. 기존 데이터 임포트 (10분)

#### 2-1. 로컬 환경 설정
```bash
# 1. .env.local 파일 생성
cp .env.local.example .env.local

# 2. .env.local 편집 (위에서 복사한 값 입력)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

#### 2-2. 데이터 임포트 실행
```bash
cd supabase
pip install supabase python-dotenv
python import_data.py
```

> ✅ 약 11,964건의 고객 데이터가 Supabase에 저장됩니다.

---

### STEP 3. Vercel 배포 (10분)

#### 3-1. GitHub에 코드 업로드
```bash
git init
git add .
git commit -m "분양회 CRM 초기 배포"
git remote add origin https://github.com/YOUR_USERNAME/bunyanghoe-crm.git
git push -u origin main
```

#### 3-2. Vercel 배포
1. [https://vercel.com](https://vercel.com) 접속 → GitHub 연동
2. **New Project** → GitHub 저장소 선택
3. **Environment Variables** 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` = 위에서 복사한 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 위에서 복사한 키
4. **Deploy** 클릭

> 🎉 약 2~3분 후 `https://bunyanghoe-crm.vercel.app` 형태로 배포 완료!

---

## 📋 주요 기능

| 메뉴 | 기능 |
|------|------|
| **대시보드** | 팀 KPI 요약, 팀원별 목표 달성 현황, 이번 주 미팅 목록 |
| **전체 고객** | 고객 DB 검색·필터·추가·수정·삭제 (페이지네이션 50건) |
| **파이프라인** | 가망 단계별 Kanban 뷰 (즉가입/미팅예정/연계매출/관리/계약) |
| **미팅 캘린더** | 월별 미팅 캘린더 + 날짜 클릭 상세 확인 |
| **성과 분석** | 전환 퍼널, 팀원별 KPI, 미팅 결과 분포 |

---

## 🔧 로컬 개발

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## 📊 데이터 구조

### contacts 테이블
| 컬럼 | 설명 |
|------|------|
| name | 고객명 |
| phone | 연락처 |
| customer_type | 신규 / 기고객 |
| assigned_to | 담당팀원 (조계현/이세호/기여운/최연전) |
| has_tm | TM 여부 |
| tm_date | TM 일자 |
| tm_sensitivity | TM 감도 (상/중/하) |
| prospect_type | 가망 구분 (즉가입가망/미팅예정가망/연계매출가망고객) |
| meeting_date | 미팅 일정 |
| meeting_address | 미팅 장소 / 현장명 |
| memo | 비고 / 특이사항 |
| meeting_result | 미팅 결과 |
| contract_date | 계약 완료일 |

---

## 💡 향후 확장 아이디어

- **알림 기능**: 미팅 D-1 카카오톡 알림 (Supabase Edge Functions + 카카오 API)
- **월간 목표 수정**: 관리자 페이지에서 목표 변경
- **엑셀 내보내기**: 월별 실적 Excel 다운로드
- **모바일 앱**: React Native 또는 PWA 전환
- **인증**: Supabase Auth로 팀원별 로그인 분리

---

비용: **₩0** | Supabase 무료 tier (500MB DB, 5만 행) + Vercel 무료 tier
