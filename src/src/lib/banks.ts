// ─────────────────────────────────────────────
// 은행/증권사 코드 리스트
// - code: 금융결제원 표준 3자리 코드
// - name: 은행명
// - group: 표시 그룹 (메이저/지방/외국/저축/증권)
// ─────────────────────────────────────────────

export interface Bank {
  code: string;
  name: string;
  group: "major" | "local" | "foreign" | "saving" | "securities";
}

export const BANK_LIST: Bank[] = [
  // 주요 시중은행 + 인터넷은행
  { code: "004", name: "국민은행",        group: "major" },
  { code: "088", name: "신한은행",        group: "major" },
  { code: "020", name: "우리은행",        group: "major" },
  { code: "081", name: "KEB하나은행",     group: "major" },
  { code: "011", name: "농협은행",        group: "major" },
  { code: "003", name: "기업은행",        group: "major" },
  { code: "090", name: "카카오뱅크",      group: "major" },
  { code: "089", name: "케이뱅크",        group: "major" },
  { code: "092", name: "토스뱅크",        group: "major" },
  { code: "002", name: "산업은행",        group: "major" },
  { code: "007", name: "수협은행",        group: "major" },
  { code: "012", name: "지역농축협",      group: "major" },
  { code: "071", name: "우체국",          group: "major" },

  // 지방은행
  { code: "031", name: "아이엠뱅크(대구)", group: "local" },
  { code: "032", name: "부산은행",        group: "local" },
  { code: "034", name: "광주은행",        group: "local" },
  { code: "035", name: "제주은행",        group: "local" },
  { code: "037", name: "전북은행",        group: "local" },
  { code: "039", name: "경남은행",        group: "local" },

  // 외국계
  { code: "027", name: "씨티은행",        group: "foreign" },
  { code: "023", name: "SC제일은행",      group: "foreign" },
  { code: "054", name: "HSBC",            group: "foreign" },
  { code: "055", name: "도이치은행",      group: "foreign" },
  { code: "056", name: "ABN암로",         group: "foreign" },
  { code: "057", name: "JP모간",          group: "foreign" },
  { code: "060", name: "BOA",             group: "foreign" },
  { code: "061", name: "BNP파리바",       group: "foreign" },
  { code: "062", name: "공상은행",        group: "foreign" },
  { code: "063", name: "중국은행",        group: "foreign" },
  { code: "005", name: "외환은행",        group: "foreign" },

  // 저축·상호금융·기타
  { code: "045", name: "새마을금고",      group: "saving" },
  { code: "048", name: "신협",            group: "saving" },
  { code: "050", name: "상호저축은행",    group: "saving" },
  { code: "064", name: "산림조합",        group: "saving" },
  { code: "083", name: "평화은행",        group: "saving" },

  // 증권사
  { code: "209", name: "유안타증권",      group: "securities" },
  { code: "218", name: "KB증권",          group: "securities" },
  { code: "221", name: "상상인증권",      group: "securities" },
  { code: "225", name: "IBK투자증권",     group: "securities" },
  { code: "227", name: "다올투자증권",    group: "securities" },
  { code: "230", name: "미래에셋증권",    group: "securities" },
  { code: "240", name: "삼성증권",        group: "securities" },
  { code: "243", name: "한국투자증권",    group: "securities" },
  { code: "247", name: "NH투자증권",      group: "securities" },
  { code: "261", name: "교보증권",        group: "securities" },
  { code: "262", name: "아이엠증권",      group: "securities" },
  { code: "263", name: "현대차증권",      group: "securities" },
  { code: "264", name: "키움증권",        group: "securities" },
  { code: "265", name: "LS증권",          group: "securities" },
  { code: "266", name: "SK증권",          group: "securities" },
  { code: "267", name: "대신증권",        group: "securities" },
  { code: "269", name: "한화증권",        group: "securities" },
  { code: "270", name: "하나증권",        group: "securities" },
  { code: "271", name: "토스증권",        group: "securities" },
  { code: "278", name: "신한투자증권",    group: "securities" },
  { code: "280", name: "유진투자증권",    group: "securities" },
  { code: "287", name: "메리츠종금",      group: "securities" },
  { code: "288", name: "카카오페이증권",  group: "securities" },
  { code: "290", name: "부국증권",        group: "securities" },
  { code: "291", name: "신영증권",        group: "securities" },
];

export const GROUP_LABELS: Record<Bank["group"], string> = {
  major:      "■ 주요 은행",
  local:      "■ 지방은행",
  foreign:    "■ 외국계",
  saving:     "■ 저축/상호",
  securities: "■ 증권사",
};

// 은행코드 → 은행명 매핑 헬퍼
export const findBankByCode = (code: string): Bank | undefined =>
  BANK_LIST.find(b => b.code === code);

// 은행명 → 은행 매핑 헬퍼 (완전 일치)
export const findBankByName = (name: string): Bank | undefined =>
  BANK_LIST.find(b => b.name === name);

// 검색 (은행명 또는 코드)
export const searchBanks = (keyword: string): Bank[] => {
  if (!keyword) return BANK_LIST;
  const k = keyword.toLowerCase().trim();
  return BANK_LIST.filter(
    b => b.name.toLowerCase().includes(k) || b.code.includes(k)
  );
};
