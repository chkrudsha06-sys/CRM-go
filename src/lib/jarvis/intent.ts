// src/lib/jarvis/intent.ts
// 질문 의도 분류기 — 어떤 경로로 처리할지 결정

export type IntentCategory =
  | "customer_lookup"      // 고객 조회 (이정재 본부장 정보)
  | "activity_history"     // 활동 이력 (최근 활동노트)
  | "sales_analytics"      // 매출 분석
  | "task_schedule"        // 업무·결재·일정
  | "kpi_activity"         // 활동량·KPI
  | "bunyanghoe_ops"       // 분양회 운영 (회원·회비)
  | "knowledge"            // 도메인 지식 (분양회 혜택 등)
  | "write_action"         // 쓰기 액션 (노트 추가 등)
  | "insight_combined"     // 종합 인사이트 (오늘 브리핑)
  | "greeting"             // 인사
  | "unclear";             // 분류 불가

export type IntentResult = {
  category: IntentCategory;
  confidence: number;  // 0-1
  keywords: string[];
  needsCrmData: boolean;
  needsKnowledge: boolean;
  isWriteAction: boolean;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 키워드 패턴 — 빠른 1차 분류
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PATTERNS = {
  // 쓰기 액션
  write_action: [
    /추가해\s*줘/, /추가해\s*달라/, /등록해\s*줘/, /기록해\s*줘/, /입력해\s*줘/,
    /수정해\s*줘/, /바꿔\s*줘/, /변경해\s*줘/, /업데이트해\s*줘/,
    /삭제해\s*줘/, /없애\s*줘/, /제거해\s*줘/,
    /작성해\s*줘/, /만들어\s*줘/, /처리해\s*줘/, /이관해\s*줘/, /옮겨\s*줘/,
    /완료\s*처리/, /상태.*변경/,
  ],

  // 고객 조회
  customer_lookup: [
    /\b(누구|어떤 사람|정보|프로필|상세)\b/,
    /연락처/, /전화번호/, /담당자/, /소속/, /회사/,
    /B\s*-?\s*\d+/, /B넘버/, /입회번호/,
  ],

  // 활동 이력
  activity_history: [
    /활동노트/, /노트/, /최근.*나눈/, /통화.*요약/, /녹취/,
    /만난.*횟수/, /이력/, /히스토리/, /AI.*요약/,
    /언제.*만났/, /몇.*번.*만났/, /지난번.*통화/,
  ],

  // 매출 분석
  sales_analytics: [
    /매출/, /수익/, /결제/, /환불/, /입금/,
    /사이다페이/, /효성CMS/, /호갱노노/, /LMS/, /하이타[겟켓]/,
    /월별/, /일별/, /채널별/, /담당자별/, /순위/,
    /이번달.*돈/, /얼마.*벌었/,
  ],

  // 업무·결재·일정
  task_schedule: [
    /업무요청/, /업무\s*요청/, /결재/, /승인/, /반려/,
    /일정/, /캘린더/, /미팅/, /약속/, /스케줄/,
    /완판트럭/, /출장/, /발주/,
    /내가.*해야/, /처리해야/, /기한/, /데드라인/,
  ],

  // 활동량·KPI
  kpi_activity: [
    /KPI/, /목표/, /달성률/, /활동량/,
    /TM.*몇.*건/, /콜드톡.*몇.*건/, /일별\s*활동/,
    /목표\s*대비/, /진척/, /진행률/, /성과/,
    /전환율/,
  ],

  // 분양회 운영
  bunyanghoe_ops: [
    /분양회\s*회원/, /입회자/, /회원\s*명단/, /계약완료/, /예약완료/,
    /VIP\s*100명/, /가입\s*임박/, /신규\s*가입/,
    /회비.*미납/, /회비.*결제/, /이번주\s*결제/,
    /이탈/,
  ],

  // 도메인 지식
  knowledge: [
    /분양회.*뭐/, /분양회.*혜택/, /분양회.*가입/, /분양회.*특전/,
    /광고특전/, /홍보특전/, /네트워킹특전/,
    /비싸다고/, /거절/, /반박/, /설명해/, /알려줘.*뭐/, /뭐야/,
    /정책/, /기준/, /원칙/, /절차/, /프로세스/,
    /넥스트\s*광고인/, /분신\s*유니버스/, /비전/, /방향성/,
    /호갱노노.*단가/, /LMS.*단가/, /가격/,
    /페이백/, /클린/,
    /3가지\s*마인드/, /3C/, /고객중심/, /창조자/, /결과중심/,
    /회사.*소개/, /광고인.*뭐/, /분양의신.*뭐/,
  ],

  // 종합 인사이트
  insight_combined: [
    /오늘\s*브리핑/, /오늘\s*챙겨야/, /오늘.*뭐\s*해야/,
    /우선순위/, /추천해\s*줘/,
    /주간\s*리뷰/, /월간\s*회고/, /지난주.*잘한/,
    /진단해\s*줘/, /코칭/, /분석해\s*줘/,
    /이관.*후보/, /가입\s*권유.*추천/,
  ],

  // 인사
  greeting: [
    /^안녕/, /^반가워/, /^하이/, /^헬로/, /^자비스$/, /고마워$/, /수고/,
  ],
};

/**
 * 패턴 매칭으로 1차 분류 (빠르고 비용 0)
 */
export function classifyByPattern(message: string): IntentResult {
  const text = message.trim();
  const lower = text.toLowerCase();
  const matched: IntentCategory[] = [];

  for (const [cat, regexes] of Object.entries(PATTERNS) as [IntentCategory, RegExp[]][]) {
    for (const re of regexes) {
      if (re.test(text) || re.test(lower)) {
        matched.push(cat);
        break;
      }
    }
  }

  // 쓰기 액션은 다른 카테고리와 함께 나올 수 있음 (예: "이정재 본부장에게 노트 추가")
  const isWrite = matched.includes("write_action");

  // 카테고리 우선순위 (여러 개 매칭 시 더 구체적인 것 우선)
  // 예: "담당자별 분양회 입회자"는 sales(담당자별)보다 bunyanghoe_ops(입회자)가 우선
  const PRIORITY: IntentCategory[] = [
    "knowledge",          // 지식 질문이면 최우선 (가짜 데이터 방지)
    "bunyanghoe_ops",     // 분양회 회원/입회자
    "activity_history",   // 활동 이력
    "customer_lookup",    // 고객 조회
    "kpi_activity",       // KPI
    "task_schedule",      // 업무·일정
    "sales_analytics",    // 매출 (담당자별 등 일반 키워드라 후순위)
    "insight_combined",
    "greeting",
  ];
  const nonWrite = matched.filter((c) => c !== "write_action");
  let primary: IntentCategory = "unclear";
  for (const p of PRIORITY) {
    if (nonWrite.includes(p)) { primary = p; break; }
  }
  if (primary === "unclear" && nonWrite.length > 0) primary = nonWrite[0];

  // 키워드 추출 (이름·B넘버 등 핵심 명사)
  const keywords = extractKeywords(text);

  return {
    category: isWrite ? "write_action" : primary,
    confidence: matched.length > 0 ? 0.8 : 0.3,
    keywords,
    needsCrmData: ["customer_lookup", "activity_history", "sales_analytics", "task_schedule",
                   "kpi_activity", "bunyanghoe_ops", "insight_combined", "write_action"].includes(primary),
    needsKnowledge: primary === "knowledge" || matched.includes("knowledge"),
    isWriteAction: isWrite,
  };
}

/**
 * 핵심 키워드 추출 (사람 이름, B넘버, 회사명, 시간 표현 등)
 */
export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // B넘버
  const bMatch = text.match(/B\s*-?\s*\d+/i);
  if (bMatch) keywords.push(bMatch[0].replace(/\s/g, ""));

  // 이름 + 직급 패턴 (이정재 본부장, 김중석 본부장 등)
  // Array.from으로 감싸서 TypeScript target ES5 호환
  const nameTitle = Array.from(text.matchAll(/([가-힣]{2,3})\s*(본부장|총괄본부장|팀장|부장|차장|과장|대리|컨설턴트)/g));
  for (const m of nameTitle) {
    keywords.push(`${m[1]} ${m[2]}`);
    keywords.push(m[1]);
  }

  // 회사명 (한신그룹, ○○그룹 등)
  const company = text.match(/([가-힣A-Za-z0-9]+)그룹/);
  if (company) keywords.push(company[0]);

  // 시간 표현
  if (/오늘/.test(text)) keywords.push("오늘");
  if (/어제/.test(text)) keywords.push("어제");
  if (/이번주/.test(text)) keywords.push("이번주");
  if (/지난주/.test(text)) keywords.push("지난주");
  if (/이번달/.test(text)) keywords.push("이번달");
  if (/지난달/.test(text)) keywords.push("지난달");

  // 채널명
  for (const ch of ["사이다페이", "효성CMS", "호갱노노", "LMS", "하이타겟", "하이타켓", "분양회 회비", "광고특전"]) {
    if (text.includes(ch)) keywords.push(ch);
  }

  return Array.from(new Set(keywords));
}

/**
 * 카테고리 라벨 (사람이 읽기 좋은 형태)
 */
export function getCategoryLabel(cat: IntentCategory): string {
  return {
    customer_lookup: "고객 조회",
    activity_history: "활동 이력",
    sales_analytics: "매출 분석",
    task_schedule: "업무·일정",
    kpi_activity: "활동량·KPI",
    bunyanghoe_ops: "분양회 운영",
    knowledge: "지식",
    write_action: "쓰기 액션",
    insight_combined: "종합 인사이트",
    greeting: "인사",
    unclear: "분류 불가",
  }[cat];
}
