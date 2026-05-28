// ─────────────────────────────────────────────
// 은행/증권사 코드 리스트
// - 시중은행/지방은행/외국계/저축 = 2자리 코드
// - 인터넷은행(카카오/케이/토스) = 3자리 코드 (공식 표기)
// - 증권사 = 3자리 코드 (공식 표기)
// ─────────────────────────────────────────────

export interface Bank {
  code: string;
  name: string;
  group: "major" | "local" | "foreign" | "saving" | "securities";
}

export const BANK_LIST: Bank[] = [
  // 주요 시중은행 (2자리)
  { code: "04",  name: "국민은행",        group: "major" },
  { code: "88",  name: "신한은행",        group: "major" },
  { code: "20",  name: "우리은행",        group: "major" },
  { code: "81",  name: "KEB하나은행",     group: "major" },
  { code: "11",  name: "농협은행",        group: "major" },
  { code: "03",  name: "기업은행",        group: "major" },
  { code: "02",  name: "산업은행",        group: "major" },
  { code: "07",  name: "수협은행",        group: "major" },
  { code: "12",  name: "지역농축협",      group: "major" },
  { code: "71",  name: "우체국",          group: "major" },
  // 인터넷은행 (3자리 공식 코드)
  { code: "090", name: "카카오뱅크",      group: "major" },
  { code: "089", name: "케이뱅크",        group: "major" },
  { code: "092", name: "토스뱅크",        group: "major" },

  // 지방은행 (2자리)
  { code: "31",  name: "아이엠뱅크(대구)", group: "local" },
  { code: "32",  name: "부산은행",        group: "local" },
  { code: "34",  name: "광주은행",        group: "local" },
  { code: "35",  name: "제주은행",        group: "local" },
  { code: "37",  name: "전북은행",        group: "local" },
  { code: "39",  name: "경남은행",        group: "local" },

  // 외국계 (2자리)
  { code: "27",  name: "씨티은행",        group: "foreign" },
  { code: "23",  name: "SC제일은행",      group: "foreign" },
  { code: "54",  name: "HSBC",            group: "foreign" },
  { code: "55",  name: "도이치은행",      group: "foreign" },
  { code: "56",  name: "ABN암로",         group: "foreign" },
  { code: "57",  name: "JP모간",          group: "foreign" },
  { code: "60",  name: "BOA",             group: "foreign" },
  { code: "61",  name: "BNP파리바",       group: "foreign" },
  { code: "62",  name: "공상은행",        group: "foreign" },
  { code: "63",  name: "중국은행",        group: "foreign" },
  { code: "05",  name: "외환은행",        group: "foreign" },

  // 저축·상호금융·기타 (2자리)
  { code: "45",  name: "새마을금고",      group: "saving" },
  { code: "48",  name: "신협",            group: "saving" },
  { code: "50",  name: "상호저축은행",    group: "saving" },
  { code: "64",  name: "산림조합",        group: "saving" },
  { code: "83",  name: "평화은행",        group: "saving" },

  // 증권사 (3자리 공식 코드)
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

// 은행코드 → 은행 매핑 헬퍼
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
