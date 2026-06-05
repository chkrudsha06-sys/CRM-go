# Pipeline2 Design Plan

## 1. Purpose

Pipeline2 is the sales execution workspace for customers first registered in the Customer DB. The Customer DB remains the source-of-truth intake area, while Pipeline2 focuses on everything managers do before a customer becomes a contract.

The core intent is simple:

- Customer DB stores and grades incoming customer records.
- Pipeline2 automatically receives assigned customer records from Customer DB.
- Managers move customers through sales stages, record events, schedule meetings, review call summaries, and convert qualified customers to contract.
- Customers that reach contract completion leave Pipeline2 and move to a separate Contract Management or Retention Management menu.

Pipeline2 should not become a dense customer database screen. It should feel like an execution board: fast to scan, easy to update, and focused on the next action.

## 2. Menu Role Split

### Customer DB

Customer DB is the intake and assessment workspace.

Primary responsibilities:

- Store source customer records.
- Track intake route.
- Assign manager.
- Run customer grade assessment.
- Track unreviewed customers.
- Preserve original DB information.
- Provide the initial feed for Pipeline2.

Customer DB should answer:

- Where did this customer come from?
- Who owns this customer?
- Has this customer been reviewed?
- What is the automatic grade?
- Is this customer ready for sales execution?

### Pipeline2

Pipeline2 is the pre-contract sales execution workspace.

Primary responsibilities:

- Show customers by manager and sales stage.
- Move customers through stages.
- Record activity events.
- Add activity notes.
- Manage meeting and follow-up actions.
- Surface AI call summaries.
- Trigger KakaoWork alerts when needed.
- Convert a customer to contract.

Pipeline2 should answer:

- What stage is this customer in now?
- What happened most recently?
- What should the manager do next?
- Which customers need immediate action?
- Which customers are ready to convert?

## 3. Stage Model

Pipeline2 should use the existing management-stage concept but display more user-friendly labels in the board UI.

| Internal Stage | Friendly Label | Meaning |
| --- | --- | --- |
| 관리구간 | DB 배정 | Customer has entered the execution pipeline and is assigned to a manager. |
| 리드 | 1차 접점 | First contact attempt or initial response phase. |
| 프로스펙팅 | 상담 진행 | Active qualification, consultation, and relationship-building phase. |
| 딜클로징 | 계약 전환 | Final persuasion, contract conditions, and conversion phase. |
| 리텐션(계약) | 계약 완료 | Contract is complete and should be transferred out of Pipeline2. |

Recommended board columns:

1. DB 배정
2. 1차 접점
3. 상담 진행
4. 계약 전환
5. 계약 완료

The final column should work as a transition state, not as a long-term storage column. Once a customer is contract-complete, the record should be moved to Contract Management or Retention Management.

## 4. Customer Flow

1. A customer is created in Customer DB.
2. Customer DB stores intake route, manager, automatic grade, and unreviewed status.
3. If the customer has an assigned manager, Pipeline2 includes the customer automatically.
4. Pipeline2 starts the customer in DB 배정 unless an existing management stage maps to another stage.
5. A manager performs sales activity and records events.
6. Each event creates an activity note.
7. Certain events optionally trigger KakaoWork notifications.
8. Google Drive call recordings summarized by Gemini appear in the call-summary tab.
9. When 계약완료 occurs, the customer is transferred to Contract Management or Retention Management.

## 5. Board Layout

Pipeline2 should use a compact kanban-style board with stage columns. The goal is to make manager action visible without overloading the first screen.

Recommended top controls:

- Manager filter
- Intake route filter
- Automatic grade filter
- Unreviewed/reviewed filter
- Next action due filter
- Search by customer name or phone

Recommended summary indicators:

- Total active pipeline customers
- Customers needing next action
- Meetings confirmed today/this week
- Contract-likely customers
- Contract completed this month

These indicators should be compact. Pipeline2 should prioritize the board and customer cards over large dashboard panels.

## 6. Compact Customer Card

Initial board cards should show only the minimum information needed for quick sales action.

Required card fields:

- Customer name
- Title
- Manager
- Phone
- Automatic grade
- Last activity date
- Next action

Recommended card structure:

```text
고객명 / 직급
담당자 · 연락처
자동등급
마지막 활동일
다음 액션
```

Card design principles:

- Avoid showing every Customer DB field.
- Avoid large memo blocks on the card.
- Use badges for grade and stage.
- Use a small overdue indicator when the next action is late.
- Keep the card height stable across columns.
- Open the detail panel for deeper information instead of expanding the card.

## 7. Detail Panel Structure

Clicking a customer card should open a side detail panel. The panel is where dense information and sales actions live.

Recommended tabs:

1. 기본정보
2. 활동노트
3. 미팅/일정
4. 통화요약
5. 단계이동
6. 계약전환

### 기본정보

Shows essential Customer DB information:

- Customer name
- Title
- Phone
- Intake route
- Manager
- Company
- Automatic grade
- Review status
- Current Pipeline2 stage
- Created date

### 활동노트

Shows customer activity history and manually added notes.

Each note should include:

- Date/time
- Author or manager
- Event type
- Note body
- Optional linked schedule or call summary

### 미팅/일정

Shows meeting and follow-up state.

Suggested fields:

- Meeting status
- Meeting date/time
- Meeting location
- Meeting result
- Next follow-up date
- Next action owner

### 통화요약

Shows AI summaries generated from Google Drive call recordings and Gemini.

Suggested fields:

- Call date
- Matched phone number
- Manager folder source
- Summary
- Key customer needs
- Next action suggested by AI
- Original Drive file link, if available
- Processing status from call recording logs

### 단계이동

Allows the manager to move the customer to another Pipeline2 stage.

Recommended interactions:

- Current stage display
- Target stage selector
- Move reason
- Optional note
- Save stage movement

Every stage move should create an activity note automatically.

### 계약전환

Used when a customer is ready to become a contract.

Suggested fields:

- Contract status
- Contract expected date
- Contract completed date
- Product/site
- Contract amount or expected value, if available
- Transfer target menu
- Contract manager or retention owner

When contract completion is saved, the customer should no longer remain as an active Pipeline2 customer.

## 8. Event Buttons

The detail panel should include quick event buttons. These buttons reduce manual typing and keep activity history consistent.

Recommended event buttons:

- 통화완료
- 부재중
- 미팅확정
- 미팅완료
- 계약유력
- 계약완료
- 보류
- 탈락
- 카카오워크 알림
- 활동노트 추가

Suggested behavior:

| Event | Activity Note | Stage Impact | KakaoWork Alert |
| --- | --- | --- | --- |
| 통화완료 | Add call-completed note | Optional move to 1차 접점 or 상담 진행 | Optional |
| 부재중 | Add missed-call note | Keep current stage | Optional |
| 미팅확정 | Add meeting-confirmed note | Move to 상담 진행 if needed | Recommended |
| 미팅완료 | Add meeting-completed note | Optional move to 계약 전환 | Optional |
| 계약유력 | Add high-probability note | Move to 계약 전환 | Recommended |
| 계약완료 | Add contract-completed note | Move to 계약 완료, then transfer | Required |
| 보류 | Add hold note | Keep or move to hold-like state | Optional |
| 탈락 | Add lost note | Remove from active execution view | Optional |
| 카카오워크 알림 | Add notification note if sent | No stage impact by default | Required by action |
| 활동노트 추가 | Add manual note | No stage impact by default | Optional |

Event buttons should be visible but not overwhelming. Primary actions can be shown directly, while lower-frequency actions can live inside a menu.

## 9. Activity Note Automation

Every major Pipeline2 event should create a customer activity note automatically.

Recommended note format:

```text
[Pipeline2 이벤트]
이벤트: 미팅확정
단계: 1차 접점 -> 상담 진행
담당자: 조계현
다음 액션: 미팅 준비
메모: ...
```

Benefits:

- Managers do not need to manually write every routine update.
- Customer history remains consistent.
- KakaoWork notification history can be traced.
- Stage movement and sales activity are auditable.

## 10. KakaoWork Integration

Pipeline2 should connect to KakaoWork only for events where notification creates real operational value.

Recommended notification triggers:

- New customer assigned
- Meeting confirmed
- Contract likely
- Contract completed
- AI call summary completed
- Follow-up overdue, if later implemented

Notification principles:

- Do not send KakaoWork messages for every tiny action.
- Include a direct CRM link to the customer or Pipeline2 detail panel.
- Use the current CRM-go production URL, not the old project URL.
- Prefer structured KakaoWork Block Kit templates once the message format is confirmed.

## 11. Call Summary Integration

The existing Google Drive call-recording flow should remain owned by the call-recording APIs. Pipeline2 should only display the results.

Current source flow:

1. Google Drive folder is scanned by manager.
2. Audio file is matched to a customer by phone number.
3. Gemini creates the call summary.
4. Summary is saved to `contact_notes`.
5. Processing status is saved to `call_recording_logs`.

Pipeline2 display flow:

1. Detail panel opens for a customer.
2. 통화요약 tab reads call-summary notes linked to that customer.
3. If available, show latest summary first.
4. Show processing status from logs when useful.
5. Allow manager to turn AI summary into next action or activity note.

Important boundary:

- Pipeline2 should not duplicate the audio processing logic.
- Pipeline2 should not modify Google Drive, Gemini, OAuth, or Cron logic.
- Pipeline2 should be a viewer and execution layer for the summarized result.

## 12. Contract Management Separation

Customers who reach 계약 완료 should move out of Pipeline2.

Recommended target menu names:

- 계약관리
- 리텐션관리

The exact name can be chosen later, but the role should be separate from Pipeline2.

### Why Separate Contract Customers?

Pipeline2 is a pre-contract sales execution space. Its job is to help managers convert customers.

Contract Management is a post-contract operation space. Its job is to manage what happens after conversion.

Keeping contract customers inside Pipeline2 causes several problems:

- The board becomes crowded with customers who no longer need sales follow-up.
- Active pre-contract opportunities become harder to scan.
- Contract tasks have different workflows from sales tasks.
- Settlement, rewards, MGM, retention, and renewal logic do not belong in a sales pipeline board.
- Reporting becomes confusing because active opportunities and completed contracts mix together.

Recommended split:

| Menu | Main Job |
| --- | --- |
| Pipeline2 | Pre-contract sales execution, event recording, stage movement, conversion |
| Contract Management | Settlement, post-care, referral/MGM, rewards, retention, renewal |

## 13. Data Model Direction

No immediate Supabase structure change is required for this design document. Future implementation can start from existing customer records and notes.

Potential future data concepts:

- Pipeline stage
- Last activity date
- Next action
- Next action due date
- Event type
- Event actor
- Contract transfer status
- Contract management record ID

Implementation should first reuse existing fields where possible. Add schema only after the UI flow is proven.

## 14. Implementation Plan

1. 설계 문서 생성
   - Create this design document and align on the product boundary.

2. 파이프라인2 라우트/메뉴 생성
   - Add `/pipeline2` route.
   - Add sidebar menu entry.
   - Keep the first version read-only if needed.

3. 고객DB 데이터 자동 유입
   - Read customers created in Customer DB.
   - Include assigned customers automatically.
   - Map management stages to Pipeline2 stages.

4. 컴팩트 고객카드 UI 생성
   - Build stage columns.
   - Show only customer name, title, manager, phone, grade, last activity date, and next action.

5. 상세 패널 생성
   - Add tabs for 기본정보, 활동노트, 미팅/일정, 통화요약, 단계이동, 계약전환.

6. 단계 이동/활동노트 이벤트 연결
   - Add event buttons.
   - Auto-create activity notes for stage movement and key events.

7. 카카오워크 알림 연결
   - Start with high-value events: meeting confirmed, contract likely, contract completed.
   - Reuse existing KakaoWork notification patterns.

8. 계약관리 메뉴 분리
   - Create Contract Management or Retention Management menu.
   - Transfer contract-complete customers out of Pipeline2.
   - Add post-contract workflows later.

## 15. Acceptance Checklist

- Pipeline2 purpose is clearly defined.
- Customer DB and Pipeline2 roles are separated.
- Stage model includes both internal and friendly labels.
- Compact customer card structure is defined.
- Detail panel tabs are defined.
- Event buttons and activity note automation are defined.
- KakaoWork notification flow is described.
- Google Drive/Gemini call-summary display flow is described.
- Contract Management separation is explained.
- Implementation order is listed step by step.
- No existing application code is changed by this document.
