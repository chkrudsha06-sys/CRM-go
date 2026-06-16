// src/lib/jarvis/prompt.ts
// 시스템 프롬프트 — 분양의신 페르소나 + 답변 규칙

import type { IntentCategory } from "./intent";

/**
 * 자비스 V2의 페르소나·도메인 사전·답변 규칙을 정의하는 시스템 프롬프트
 */
export function buildSystemPrompt(params: {
  category: IntentCategory;
  user: { name: string; title?: string; role?: string };
  knowledgeContext?: string;
  crmContext?: string;
  hasWriteTools: boolean;
  nowLabel: string;
}): string {
  const { category, user, knowledgeContext, crmContext, hasWriteTools, nowLabel } = params;

  const persona = `당신은 광고인㈜ 대외협력팀의 AI 비서 "자비스"입니다.
당신의 이름은 자비스이며, 분양의신 브랜드의 도메인 전문가급 비서로 동작합니다.

[현재 사용자]
이름: ${user.name}
직급: ${user.title || "-"}
권한: ${user.role || "exec"} (admin=관리자, exec=실행파트, ops=운영파트)
현재 시각: ${nowLabel}

[당신의 역할]
1. CRM 데이터를 정확히 조회·요약·분석하여 답변한다.
2. 분양회·광고상품·회사비전 등 도메인 지식을 정확히 설명한다.
3. 쓰기 요청은 반드시 request_write_action 도구로 사용자 확인을 거친다.
4. 모르는 것은 모른다고 말한다. 추측·환각 금지.`;

  const domainRules = `[분양의신 도메인 사전 — 절대 지킬 것]
• "분양회"는 단순 멤버십이 아니라 상위 1% 분양 리더의 조직 성장 컨설팅이다.
• "분양회 회비"는 월 100만원이며, 사이다페이/효성CMS로 자동 결제된다.
• "광고특전"은 페이백/리워드/환급이 아니라 광고에이전시 가격의 공식 회원가다.
• 절대 사용 금지 표현: "페이백", "환급", "현금으로 돌려", "리워드 지급", "포인트 적립", "광고비 환급", "대량 홈페이지 제공", "누구나 가입 가능"
• 권장 표현: "공식 회원가", "공식 견적서", "광고에이전시 가격", "집행완료 확인서", "클린 광고 구조", "조직 성장 컨설팅"
• 회사 외부 노출 시 브랜드명은 "광고인" 대신 "분양의신"을 사용한다.
• "광고연계매출"은 대외협력팀 KPI에 포함되지 않는다. 대협팀 본업은 찐 VIP 발굴이다.
• 대협팀은 광고 컨설팅을 하지 않는다. 광고 니즈가 나오면 B2C 광고사업부에 토스한다.`;

  const formatRules = `[답변 형식 규칙]
• 한국어로 답변한다.
• 사용자를 "대외협력" 또는 직급으로 부른다. 이름으로 부르지 않는다.
• 데이터 기반 답변에는 출처를 명시한다. 예: "→ 이정재 본부장 프로필 ↗"
• 숫자는 콤마 포함 (예: 1,200,000원).
• 날짜는 "2026-06-16" 형식 또는 "오늘/어제/이번주" 같은 상대 표현.
• 모르는 정보는 "데이터에 없습니다"라고 명확히 말한다. 추측 금지.
• 답변은 간결하게, 핵심부터. 마크다운 헤더 과용 금지.
• 카카오톡 메시지를 작성할 때는 대구분선 ─×14, 소구분선 ─×10을 사용한다.`;

  const writeRules = hasWriteTools
    ? `[쓰기 액션 규칙 — 매우 중요]
• 사용자가 "추가/수정/삭제/등록/변경/이관/처리"를 명시적으로 요청한 경우에만 request_write_action 도구를 호출한다.
• 도구를 호출하면 사용자에게 확인 다이얼로그가 표시되고, 사용자가 [확인]을 눌러야 실제 실행된다.
• 도구 호출 시 preview_text는 사용자가 보고 즉시 판단 가능한 5줄 이내 미리보기로 작성한다.
• 단순 조회나 분석 요청에는 도구를 호출하지 않는다.
• 대상이 모호할 때는 도구 호출 대신 명확화 질문을 한다.`
    : "";

  const knowledgeSection = knowledgeContext
    ? `\n[참고 — 분양의신 내부 지식 베이스]\n${knowledgeContext}\n`
    : "";

  const crmSection = crmContext
    ? `\n[참고 — CRM 실시간 데이터]\n${crmContext}\n`
    : "";

  return [persona, domainRules, formatRules, writeRules, knowledgeSection, crmSection].filter(Boolean).join("\n\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 출처 링크 생성기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SourceLink = { label: string; url: string; type: "crm" | "knowledge" };

/**
 * CRM 컨텍스트에서 [내부 ID: 15] 같은 패턴을 찾아 페이지 링크 생성
 */
export function extractCRMSourceLinks(crmContext: string, intent: IntentCategory): SourceLink[] {
  const links: SourceLink[] = [];

  // 고객 ID 추출 (Array.from으로 TypeScript target ES5 호환)
  const idMatches = Array.from(crmContext.matchAll(/\[내부 ID:\s*(\d+)\]/g));
  const nameMatches = Array.from(crmContext.matchAll(/이름:\s*([가-힣]+)\s*([^\n]*)/g));
  const names = nameMatches.map((m) => `${m[1].trim()} ${m[2].trim()}`.trim());
  const ids = idMatches.map((m) => parseInt(m[1], 10));

  ids.forEach((id, i) => {
    const name = names[i] || `고객 ${id}`;
    links.push({ label: `${name} 프로필`, url: `/contacts/${id}`, type: "crm" });

    if (intent === "activity_history") {
      links.push({ label: `${name} 활동노트`, url: `/contacts/${id}#notes`, type: "crm" });
      links.push({ label: `${name} 회원 타임라인`, url: `/member-timeline?id=${id}`, type: "crm" });
    }
  });

  // 카테고리별 페이지 링크 (CRM 안에서 이동)
  const pageMap: Record<IntentCategory, { label: string; url: string } | null> = {
    customer_lookup: { label: "VIP활동DB", url: "/contacts" },
    activity_history: null, // 위에서 처리
    sales_analytics: { label: "통합매출관리", url: "/sales" },
    task_schedule: { label: "결제&업무요청", url: "/tasks" },
    kpi_activity: { label: "일별활동기록", url: "/daily-activity" },
    bunyanghoe_ops: { label: "분양회 입회자", url: "/vip-members" },
    insight_combined: { label: "팀 성과 분석", url: "/reports" },
    knowledge: null,
    write_action: null,
    greeting: null,
    unclear: null,
  };

  const page = pageMap[intent];
  if (page) {
    links.push({ label: page.label, url: page.url, type: "crm" });
  }

  // 중복 제거
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

/**
 * 지식 베이스 검색 결과를 출처 링크로 변환
 * (실제 파일이 GitHub 또는 사내 위키에 있다면 URL 매핑)
 */
export function extractKnowledgeSourceLinks(knowledgeChunks: Array<{ source_file: string; title: string }>): SourceLink[] {
  const seen = new Set<string>();
  return knowledgeChunks
    .filter((c) => {
      if (seen.has(c.source_file)) return false;
      seen.add(c.source_file);
      return true;
    })
    .map((c) => {
      // 파일명에서 카테고리 추출
      const category = c.source_file.split("/")[0].replace(/^\d+_/, "");
      const fileName = c.source_file.split("/").pop()?.replace(".md", "") || "";
      const label = `[지식] ${categoryLabel(category)} / ${prettyFileName(fileName)}`;
      return { label, url: `/jarvis/knowledge?file=${encodeURIComponent(c.source_file)}`, type: "knowledge" as const };
    });
}

function categoryLabel(c: string): string {
  return {
    company: "회사",
    organization: "조직",
    products_bunyanghoe: "분양회",
    products_advertising: "광고상품",
    processes: "프로세스",
    industry: "도메인",
    brand: "브랜드",
  }[c] || c;
}

function prettyFileName(f: string): string {
  return {
    overview: "개요",
    vision: "비전",
    three_mindsets: "3가지 마인드",
    three_benefits: "3대 특전",
    member_profile: "회원상",
    briefing_script: "브리핑 스크립트",
    objection_handling: "반박 대응",
    payback_clean_branding: "페이백·클린광고",
    customer_diagnosis_card: "고객진단카드",
    hogangnono: "호갱노노",
    lms: "LMS",
    vip_transfer_flow: "VIP 이관 흐름",
    glossary: "용어 사전",
    design_system: "디자인 시스템",
    external_cooperation_team: "대외협력팀",
    ad_business_division: "광고사업부",
    tf2_team: "TF2팀",
    directory: "임직원 명단",
    kpi_policy: "KPI 정책",
  }[f] || f;
}
