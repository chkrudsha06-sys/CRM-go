// src/lib/jarvis/tools.ts
// Write Action 도구 정의 — Claude Function Calling

import type { LLMTool } from "./llm";

/**
 * 자비스가 쓰기 액션이 필요하다고 판단하면 이 도구를 호출.
 * 즉시 실행하지 않고 사용자 확인 → /api/ai-chat/confirm으로 실행.
 */
export const REQUEST_WRITE_ACTION_TOOL: LLMTool = {
  name: "request_write_action",
  description: `DB에 데이터를 쓰기 전 사용자 확인을 요청합니다.
사용자가 명시적으로 "추가/수정/삭제/등록/변경/이관/처리"를 요청할 때만 호출하세요.
조회 요청에는 절대 호출하지 마세요.`,
  input_schema: {
    type: "object",
    required: ["action_type", "target_label", "payload", "preview_text"],
    properties: {
      action_type: {
        type: "string",
        enum: [
          // 고객 데이터
          "add_note",                  // 활동노트 추가
          "update_contact_field",      // 고객 정보 수정 (직급·담당자·관리단계·등급·미팅결과 등)
          "transfer_to_vip",           // VIP DB로 이관
          // 매출
          "add_sales_record",          // 매출 등록 (광고/회비)
          "update_refund",             // 환불 처리
          // 업무·결재·일정
          "create_task",               // 업무요청 생성
          "update_task_status",        // 업무 상태 변경
          "add_task_comment",          // 업무 코멘트
          "create_approval",           // 결재 신청
          "create_calendar_event",     // 일정 등록
          "create_wanpan_truck",       // 완판트럭 등록
          // 활동 기록
          "upsert_daily_activity",     // 일별 활동 입력
          // 메모·공지
          "add_memo",                  // 메모 추가
          "add_notice",                // 공지 등록 (admin 전용)
          "update_slogan",             // 사이드바 슬로건 변경
          // 콘텐츠 단계
          "update_content_status",     // 콘텐츠 제작 단계 진행
        ],
        description: "수행할 액션의 종류",
      },
      target_table: {
        type: "string",
        description: "쓰기 대상 테이블 (예: 'contact_notes', 'contacts', 'tasks')",
      },
      target_id: {
        type: "number",
        description: "기존 레코드 수정/추가 대상 ID (있는 경우)",
      },
      target_label: {
        type: "string",
        description: "사용자에게 보여줄 대상 이름 (예: '이정재 본부장 (B-7)')",
      },
      payload: {
        type: "object",
        description: "실제 DB에 쓸 데이터 객체. 컬럼명을 키로 사용.",
      },
      preview_text: {
        type: "string",
        description: "확인 다이얼로그에 표시할 한국어 미리보기. 5줄 이내, 사용자가 보고 OK/취소 판단 가능해야 함.",
      },
      permission_check: {
        type: "string",
        description: "권한 확인 메모. 예: '관리자 전용' / '본인 담당 고객만'. 선택사항.",
      },
    },
  },
};

/**
 * 액션 타입별 → 실제 Supabase 테이블 매핑
 */
export const ACTION_TABLE_MAP: Record<string, string> = {
  add_note: "contact_notes",
  update_contact_field: "contacts",
  transfer_to_vip: "contacts",
  add_sales_record: "ad_executions",
  update_refund: "ad_executions",
  create_task: "tasks",
  update_task_status: "tasks",
  add_task_comment: "task_comments",
  create_approval: "approval_requests",
  create_calendar_event: "calendar_custom_events",
  create_wanpan_truck: "wanpan_trucks",
  upsert_daily_activity: "daily_activity_goals",
  add_memo: "memos",
  add_notice: "notices",
  update_slogan: "crm_user_slogans",
  update_content_status: "content_statuses",
};

/**
 * 액션이 어떤 권한을 요구하는지
 */
export const ACTION_PERMISSION_MAP: Record<string, "admin" | "any"> = {
  add_notice: "admin",
  // 나머지는 모두 "any" (로그인 사용자)
};

export function checkPermission(action_type: string, userRole?: string): { allowed: boolean; reason?: string } {
  const required = ACTION_PERMISSION_MAP[action_type] || "any";
  if (required === "admin" && userRole !== "admin") {
    return { allowed: false, reason: "이 액션은 관리자만 수행할 수 있습니다." };
  }
  return { allowed: true };
}
