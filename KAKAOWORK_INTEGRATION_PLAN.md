# 카카오워크 CRM 알림 연동 프로젝트 계획서

이 문서는 CRM에 카카오워크 봇 알림을 연동하기 위한 향후 개발 계획서입니다.

목표는 아래 두 가지입니다.

1. 고객여정에서 담당자가 일정 기간 후속 조치를 등록하지 않은 경우 카카오워크 알림 발송
2. 결제&업무요청에서 결제 요청이 생성되거나 승인 단계가 넘어갈 때 다음 승인권자에게 카카오워크 알림 발송

## 1. 전체 연동 개요

CRM 서버가 Supabase 데이터를 기준으로 알림 대상자를 판단하고, 카카오워크 Bot API를 통해 담당자에게 메시지를 발송합니다.

기본 흐름은 다음과 같습니다.

```text
CRM 이벤트 또는 정기 점검
→ Supabase 데이터 조회
→ 알림 대상자 판단
→ 담당자의 카카오워크 이메일 확인
→ 카카오워크 Bot API 호출
→ 알림 발송 로그 저장
```

카카오워크 App Key는 브라우저에 노출되면 안 됩니다.  
따라서 카카오워크 API 호출은 반드시 Next.js API Route 또는 서버 함수에서 처리합니다.

## 2. 카카오워크 사전 준비

카카오워크 관리자 계정에서 CRM 알림용 봇을 생성합니다.

권장 봇 정보는 다음과 같습니다.

```text
봇 이름: CRM 업무 알림봇
설명: 고객여정 미진행, 결제 승인 요청, 업무 미처리 알림을 발송하는 CRM 자동 알림봇
```

필요 권한은 다음과 같습니다.

```text
메시지 발송
멤버 조회
```

담당자 이메일 기반으로 메시지를 보낼 경우, 카카오워크 계정 이메일과 CRM 사용자 이름을 매칭해야 합니다.

## 3. Vercel 환경변수

Vercel 프로젝트에 아래 환경변수를 추가합니다.

```text
KAKAO_WORK_APP_KEY=카카오워크 봇 App Key
CRM_BASE_URL=https://crm-go.vercel.app
CRON_SECRET=정기 실행 API 보호용 임의 문자열
```

주의사항:

- `KAKAO_WORK_APP_KEY`는 GitHub 코드에 직접 넣지 않습니다.
- `CRON_SECRET`은 외부에서 알림 실행 API를 무단 호출하지 못하게 막기 위해 사용합니다.
- `CRM_BASE_URL`은 카카오워크 메시지에 CRM 바로가기 링크를 넣기 위해 사용합니다.

## 4. CRM 사용자 정보 확장

카카오워크 알림을 정확히 보내려면 CRM 사용자 테이블에 카카오워크 이메일을 저장해야 합니다.

권장 컬럼:

```sql
alter table crm_users
add column if not exists kakao_work_email text;
```

예시:

```text
조계현 = example1@company.com
이세호 = example2@company.com
기여운 = example3@company.com
최연전 = example4@company.com
김창완 = manager@example.com
```

향후 관리자 화면의 계정관리 메뉴에서 `kakao_work_email`을 입력하고 수정할 수 있게 확장합니다.

## 5. 공통 알림 발송 API

카카오워크 메시지 발송은 공통 함수로 분리합니다.

예상 파일:

```text
src/lib/kakaowork.ts
```

역할:

- 카카오워크 App Key 읽기
- 담당자 이메일로 메시지 발송
- 실패 시 에러 반환
- 메시지 포맷 통일

예상 API Route:

```text
src/app/api/kakaowork/send-message/route.ts
```

프론트 화면에서 직접 카카오워크 API를 호출하지 않고, CRM 서버 API를 통해 호출합니다.

## 6. 알림 로그 테이블

중복 알림을 막기 위해 발송 로그를 저장합니다.

권장 테이블:

```sql
create table if not exists kakao_work_notification_logs (
  id bigserial primary key,
  notification_type text not null,
  target_table text,
  target_id bigint,
  recipient_name text,
  recipient_email text,
  message_title text,
  status text not null default 'sent',
  error_message text,
  sent_at timestamptz not null default now()
);
```

주요 사용 목적:

- 같은 고객에 대해 하루에 여러 번 알림이 가지 않게 제어
- 결제 승인 요청 알림이 이미 발송됐는지 확인
- 카카오워크 API 실패 원인 추적

## 7. 프로젝트 1: 고객여정 미진행 알림

### 7.1 목표

고객여정에서 담당자가 일정 기간 후속 조치를 등록하지 않은 경우 담당자에게 카카오워크 알림을 보냅니다.

예시 기준:

```text
담당 고객이 등록된 후 3일 이상 후속 활동 없음
고객여정 단계가 변경된 후 3일 이상 활동 없음
미팅 예정일이 지났지만 미팅 결과가 등록되지 않음
고객 메모 또는 활동 노트가 5일 이상 없음
```

처음에는 단순하고 명확한 기준으로 시작하는 것을 권장합니다.

1차 기준:

```text
contacts.assigned_to가 존재하고,
최근 contact_notes가 3일 이상 없고,
meeting_result가 계약완료/계약거절/미팅불가가 아닌 고객
```

### 7.2 필요한 데이터

주요 테이블:

```text
contacts
contact_notes
crm_users
kakao_work_notification_logs
```

조회 기준:

- 고객 담당자: `contacts.assigned_to`
- 고객 상태: `contacts.management_stage`, `contacts.meeting_result`
- 마지막 활동: `contact_notes.note_date` 또는 `contact_notes.created_at`
- 담당자 이메일: `crm_users.kakao_work_email`

### 7.3 알림 메시지 예시

```text
[CRM 고객여정 미진행 알림]

담당 고객: 홍길동
현재 단계: 미팅예정
마지막 활동일: 2026-05-24
미진행 기간: 4일

고객여정 업데이트 또는 후속 조치를 진행해주세요.
CRM 바로가기: https://crm-go.vercel.app/customer-journey
```

### 7.4 실행 방식

Vercel Cron을 사용해 매일 정해진 시간에 API를 실행합니다.

예상 API:

```text
GET /api/reminders/customer-journey
```

예상 실행 시간:

```text
매일 오전 9시
매일 오후 5시
```

API 보호:

```text
GET /api/reminders/customer-journey?secret=CRON_SECRET
```

또는 Authorization Header를 사용합니다.

### 7.5 구현 순서

1. `crm_users`에 `kakao_work_email` 컬럼 추가
2. 계정관리 화면에서 카카오워크 이메일 입력 가능하게 수정
3. `kakao_work_notification_logs` 테이블 생성
4. 카카오워크 메시지 발송 공통 함수 작성
5. 고객여정 미진행 대상 조회 로직 작성
6. 중복 알림 방지 로직 작성
7. Vercel Cron API 작성
8. 테스트용 수동 실행 버튼 또는 관리자 전용 실행 API 추가
9. Vercel 환경변수 추가
10. 실제 담당자 1명으로 테스트 발송

## 8. 프로젝트 2: 결제 승인권자 카카오워크 알림

### 8.1 목표

결제&업무요청에서 결제 요청이 생성되거나 승인 단계가 다음 사람에게 넘어갈 때, 현재 승인권자에게 카카오워크 알림을 보냅니다.

예시 흐름:

```text
요청자 결제 요청 생성
→ approval_requests 저장
→ current_approver_name 확인
→ 현재 승인권자 카카오워크 이메일 조회
→ 카카오워크 알림 발송
→ 승인 처리
→ 다음 승인권자에게 알림 발송
```

### 8.2 필요한 데이터

주요 테이블:

```text
approval_requests
approval_actions
crm_users
kakao_work_notification_logs
```

주요 필드:

```text
approval_requests.id
approval_requests.request_type
approval_requests.requester_name
approval_requests.current_approver_name
approval_requests.status
approval_requests.payload
approval_requests.created_at
crm_users.kakao_work_email
```

### 8.3 알림 발송 시점

1차 구현에서 권장하는 발송 시점:

```text
결제 요청 생성 직후
승인자가 승인해서 다음 승인권자로 넘어간 직후
반려된 경우 요청자에게 알림
최종 승인 완료 시 요청자에게 알림
```

### 8.4 알림 메시지 예시

결제 승인 요청:

```text
[CRM 결제 승인 요청]

요청자: 조계현
요청유형: 결제요청서
제목: 광고비 집행 결제 요청
금액: 1,500,000원
현재 승인자: 김창완

승인이 필요합니다.
CRM에서 확인하기:
https://crm-go.vercel.app/tasks
```

반려 알림:

```text
[CRM 결제 요청 반려]

요청자: 조계현
문서: 광고비 집행 결제 요청
반려자: 김창완
사유: 증빙자료 추가 필요

CRM에서 확인하기:
https://crm-go.vercel.app/tasks
```

최종 승인 완료:

```text
[CRM 결제 최종 승인 완료]

요청자: 조계현
문서: 광고비 집행 결제 요청
금액: 1,500,000원

모든 승인이 완료되었습니다.
CRM에서 확인하기:
https://crm-go.vercel.app/tasks
```

### 8.5 구현 위치

현재 결제 요청 생성 로직은 아래 화면의 결제&업무요청 페이지에 있습니다.

```text
src/app/tasks/page.tsx
```

권장 구조:

```text
src/app/tasks/page.tsx
→ /api/approval-requests
→ /api/kakaowork/approval-alert
→ Kakao Work API
```

단기 구현은 `tasks/page.tsx`에서 기존 insert/update 이후 서버 API를 호출하는 방식으로 시작할 수 있습니다.

장기적으로는 결제 요청 생성, 승인, 반려 로직을 API Route로 분리하는 것이 좋습니다.

### 8.6 중복 알림 방지

같은 승인 단계에 같은 승인권자에게 여러 번 알림이 가지 않도록 로그를 확인합니다.

중복 기준 예시:

```text
notification_type = approval_requested
target_table = approval_requests
target_id = approval_requests.id
recipient_name = current_approver_name
```

단, 승인 단계가 변경되면 새 알림을 보낼 수 있어야 합니다.  
필요하면 `approval_step` 컬럼을 로그 테이블에 추가합니다.

추가 권장 컬럼:

```sql
alter table kakao_work_notification_logs
add column if not exists approval_step int;
```

### 8.7 구현 순서

1. `crm_users`에 `kakao_work_email` 컬럼 추가
2. 승인권자들의 카카오워크 이메일 입력
3. 카카오워크 메시지 발송 공통 함수 작성
4. 결제 요청 생성 후 현재 승인권자 찾기
5. 현재 승인권자에게 알림 발송
6. 승인 처리 후 다음 승인권자에게 알림 발송
7. 반려 시 요청자에게 알림 발송
8. 최종 승인 시 요청자에게 완료 알림 발송
9. 알림 발송 로그 저장
10. 실제 결제 요청 1건으로 테스트

## 9. 보안 기준

카카오워크 연동 시 아래 기준을 반드시 지킵니다.

- `KAKAO_WORK_APP_KEY`는 GitHub에 올리지 않습니다.
- App Key는 Vercel 환경변수에만 저장합니다.
- 클라이언트 컴포넌트에서 카카오워크 API를 직접 호출하지 않습니다.
- 알림 실행 API는 `CRON_SECRET` 또는 서버 인증으로 보호합니다.
- 담당자 이메일은 관리자만 수정할 수 있게 합니다.
- 알림 로그에는 민감한 상세 내용을 과도하게 저장하지 않습니다.

## 10. 테스트 계획

### 고객여정 알림 테스트

1. 테스트 고객 1명을 생성합니다.
2. 담당자를 지정합니다.
3. 마지막 활동일이 기준일보다 오래된 상태로 만듭니다.
4. 수동으로 알림 API를 실행합니다.
5. 담당자 카카오워크에 메시지가 도착하는지 확인합니다.
6. 같은 고객에게 중복 알림이 가지 않는지 확인합니다.

### 결제 승인 알림 테스트

1. 테스트 결제 요청을 생성합니다.
2. 첫 승인권자에게 카카오워크 알림이 도착하는지 확인합니다.
3. 첫 승인자가 승인합니다.
4. 다음 승인권자에게 알림이 도착하는지 확인합니다.
5. 반려 시 요청자에게 반려 알림이 가는지 확인합니다.
6. 최종 승인 시 요청자에게 완료 알림이 가는지 확인합니다.

## 11. 향후 고도화 아이디어

1차 구현은 알림과 CRM 링크 이동 방식으로 시작합니다.

향후에는 아래 기능을 추가할 수 있습니다.

- 카카오워크 메시지 안에 승인/반려 버튼 추가
- 담당자별 알림 시간 설정
- 알림 빈도 제한
- 관리자용 알림 발송 현황 대시보드
- 고객여정 미진행 기준을 관리자 화면에서 설정
- AI가 미진행 고객을 요약해서 팀장에게 일일 리포트 발송
- 결제 요청 금액에 따라 승인 라인 자동 변경

## 12. 1차 개발 권장 범위

처음부터 모든 기능을 만들기보다 아래 범위로 시작하는 것을 권장합니다.

```text
1. 카카오워크 봇 App Key 연동
2. crm_users.kakao_work_email 추가
3. 결제 승인 요청 생성 시 현재 승인권자에게 알림 발송
4. 고객여정 미진행 알림은 관리자 수동 실행 API로 먼저 테스트
5. 안정화 후 Vercel Cron 자동 실행으로 전환
```

이 순서가 가장 안전하고, 실제 업무에서 바로 효과를 확인하기 쉽습니다.
