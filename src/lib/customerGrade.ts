export type RoleBasis = "본부장" | "팀장";

export type CustomerGrade =
  | "마스터"
  | "챌린저"
  | "추가 심사 후보"
  | "브론즈"
  | "판정 보류"
  | "심사미진행";

export type GradeAssessmentForm = {
  annual_site_count: string;
  property_type: string;
  trained_consultants: string;
  setup_people: string;
  steady_team_members: string;
  company_scale: string;
  pr_platform: string;
  networking: string;
  monthly_ad_budget: string;
  ad_operation: string;
  ad_budget_support: string;
};

export type GradeResult = {
  roleBasis: RoleBasis;
  totalScore: number;
  customerGrade: CustomerGrade;
  decisionMessage: string;
  categoryScores: {
    siteOperation: number;
    organization: number;
    branding: number;
    advertising: number;
  };
};

export const EMPTY_GRADE_ASSESSMENT: GradeAssessmentForm = {
  annual_site_count: "",
  property_type: "",
  trained_consultants: "",
  setup_people: "",
  steady_team_members: "",
  company_scale: "",
  pr_platform: "",
  networking: "",
  monthly_ad_budget: "",
  ad_operation: "",
  ad_budget_support: "",
};

export const CUSTOMER_GRADE_OPTIONS: CustomerGrade[] = [
  "마스터",
  "챌린저",
  "추가 심사 후보",
  "브론즈",
  "심사미진행",
  "판정 보류",
];

export const GRADE_SELECT_OPTIONS = {
  property_type: ["없음", "기타", "수익형", "지주택", "일반분양"],
  company_scale: ["무소속", "소규모회사", "중견회사", "대형 / 인지도 높음"],
  pr_platform: ["없음", "보유만 함", "활발히 운영"],
  networking: ["없음", "간헐적 활동", "정기적 활동"],
  ad_operation: [
    "선택 필요",
    "팀원 자율 운영",
    "본인이 직접 진행",
    "광고대행사 위탁",
    "마케팅기획담당자 보유",
  ],
  ad_budget_support: [
    "없음",
    "개인광고로 운영",
    "일부 가능",
    "본부/팀 광고비 지원 가능",
  ],
};

const START = "[[CRM_GRADE_ASSESSMENT]]";
const END = "[[/CRM_GRADE_ASSESSMENT]]";

type StoredAssessment = {
  assessment: GradeAssessmentForm;
  result: GradeResult;
  savedAt: string;
};

function toNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/[^0-9]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function detectRoleBasis(title: string): RoleBasis {
  const text = title.trim();
  if (
    text.includes("본부") ||
    text.includes("대표") ||
    text.includes("지사장") ||
    text.includes("이사")
  ) {
    return "본부장";
  }
  return "팀장";
}

function annualSiteScore(count: number) {
  if (count >= 3) return 15;
  if (count === 2) return 12;
  if (count === 1) return 10;
  return 0;
}

function propertyTypeScore(type: string) {
  if (type === "일반분양") return 5;
  if (type === "지주택") return 4;
  if (type === "기타" || type === "수익형") return 3;
  return 0;
}

function trainedConsultantsScore(count: number, role: RoleBasis) {
  if (role === "본부장") {
    if (count >= 30) return 10;
    if (count >= 20) return 8;
    if (count >= 10) return 5;
    return 0;
  }

  if (count >= 20) return 10;
  if (count >= 10) return 8;
  if (count >= 5) return 5;
  return 0;
}

function setupPeopleScore(count: number, role: RoleBasis) {
  if (role === "본부장") {
    if (count >= 100) return 23;
    if (count >= 50) return 20;
    if (count >= 30) return 15;
    if (count >= 20) return 10;
    return 0;
  }

  if (count >= 11) return 23;
  if (count >= 7) return 20;
  if (count >= 4) return 15;
  if (count >= 1) return 10;
  return 0;
}

function steadyTeamMembersScore(count: number, role: RoleBasis) {
  if (role === "본부장") {
    if (count >= 31) return 10;
    if (count >= 21) return 8;
    if (count >= 10) return 5;
    return 0;
  }

  if (count >= 5) return 10;
  if (count >= 3) return 8;
  if (count >= 1) return 5;
  return 0;
}

function companyScaleScore(scale: string) {
  if (scale === "대형 / 인지도 높음") return 7;
  if (scale === "중견회사") return 5;
  if (scale === "소규모회사") return 2;
  return 0;
}

function prPlatformScore(value: string) {
  if (value === "활발히 운영") return 10;
  if (value === "보유만 함") return 5;
  return 0;
}

function networkingScore(value: string) {
  if (value === "정기적 활동") return 10;
  if (value === "간헐적 활동") return 5;
  return 0;
}

function monthlyAdBudgetScore(amount: number, role: RoleBasis) {
  if (role === "본부장") {
    if (amount >= 3000) return 15;
    if (amount >= 2000) return 12;
    if (amount >= 1000) return 10;
    if (amount >= 1) return 5;
    return 0;
  }

  if (amount >= 1500) return 15;
  if (amount >= 1000) return 12;
  if (amount >= 500) return 10;
  if (amount >= 1) return 5;
  return 0;
}

function adOperationScore(value: string) {
  if (value === "마케팅기획담당자 보유") return 10;
  if (value === "광고대행사 위탁") return 8;
  if (value === "본인이 직접 진행") return 5;
  if (value === "팀원 자율 운영") return 3;
  return 0;
}

function adBudgetSupportScore(value: string) {
  if (value === "본부/팀 광고비 지원 가능") return 5;
  if (value === "일부 가능") return 3;
  if (value === "개인광고로 운영") return 2;
  return 0;
}

function decision(
  totalScore: number,
  role: RoleBasis,
): Pick<GradeResult, "customerGrade" | "decisionMessage"> {
  if (totalScore >= 85) {
    const customerGrade = role === "본부장" ? "마스터" : "챌린저";
    return {
      customerGrade,
      decisionMessage: `상위 1%에 해당하는 ${customerGrade} 대상입니다.`,
    };
  }

  if (totalScore >= 75) {
    return {
      customerGrade: "추가 심사 후보",
      decisionMessage:
        "별도 추가인터뷰나 검토를 통해 마스터 또는 챌린저 대상분류가 가능합니다.",
    };
  }

  if (totalScore >= 55) {
    return {
      customerGrade: "브론즈",
      decisionMessage: "브론즈 대상으로 가입분류가 가능합니다.",
    };
  }

  return {
    customerGrade: "판정 보류",
    decisionMessage:
      "현재 기준에서는 즉시 가입대상으로 보기 어렵습니다. 추가 인터뷰와 별도 검토가 필요합니다.",
  };
}

export function calculateCustomerGrade(
  assessment: GradeAssessmentForm,
  title: string,
): GradeResult {
  const roleBasis = detectRoleBasis(title);

  const siteOperation =
    annualSiteScore(toNumber(assessment.annual_site_count)) +
    propertyTypeScore(assessment.property_type) +
    trainedConsultantsScore(toNumber(assessment.trained_consultants), roleBasis);

  const organization =
    setupPeopleScore(toNumber(assessment.setup_people), roleBasis) +
    steadyTeamMembersScore(toNumber(assessment.steady_team_members), roleBasis) +
    companyScaleScore(assessment.company_scale);

  const branding =
    prPlatformScore(assessment.pr_platform) +
    networkingScore(assessment.networking);

  const advertising =
    monthlyAdBudgetScore(toNumber(assessment.monthly_ad_budget), roleBasis) +
    adOperationScore(assessment.ad_operation) +
    adBudgetSupportScore(assessment.ad_budget_support);

  const totalScore = siteOperation + organization + branding + advertising;
  const verdict = decision(totalScore, roleBasis);

  return {
    roleBasis,
    totalScore,
    customerGrade: verdict.customerGrade,
    decisionMessage: verdict.decisionMessage,
    categoryScores: {
      siteOperation,
      organization,
      branding,
      advertising,
    },
  };
}

export function hasGradeAssessmentInput(assessment: GradeAssessmentForm) {
  return Object.values(assessment).some(
    (item) => String(item || "").trim().length > 0,
  );
}

export function stripGradeAssessmentBlock(memo: string | null | undefined) {
  const raw = String(memo ?? "");

  return raw
    .replace(new RegExp(`${START}[\\s\\S]*?${END}`, "g"), "")
    .replace(/\[\[CRM_GRADE_ASSESSMENT\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSESSMENT\]\]|$)/g, "")
    .replace(/\[\[CRM_GRADE_ASSENSSMENT\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSENSSMENT\]\]|$)/g, "")
    .replace(/\[\[CRM_GRADE_ASSESSMEN[^\]]*\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSESSMEN[^\]]*\]\]|$)/g, "")
    .replace(/\[\[CRM_GRADE_ASSENSSMEN[^\]]*\]\][\s\S]*?(?:\[\[\/CRM_GRADE_ASSENSSMEN[^\]]*\]\]|$)/g, "")
    .trim();
}

export function appendGradeAssessmentBlock(
  memo: string,
  assessment: GradeAssessmentForm,
  result: GradeResult,
) {
  const cleanMemo = stripGradeAssessmentBlock(memo);

  if (!hasGradeAssessmentInput(assessment)) {
    return cleanMemo;
  }

  const block: StoredAssessment = {
    assessment,
    result,
    savedAt: new Date().toISOString(),
  };

  return `${cleanMemo}${cleanMemo ? "\n\n" : ""}${START}${JSON.stringify(
    block,
  )}${END}`;
}

function safeAssessmentFromParsed(value: unknown): GradeAssessmentForm {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_GRADE_ASSESSMENT };
  }

  const objectValue = value as Record<string, unknown>;
  const possibleAssessment =
    objectValue.assessment && typeof objectValue.assessment === "object"
      ? (objectValue.assessment as Record<string, unknown>)
      : objectValue;

  return {
    ...EMPTY_GRADE_ASSESSMENT,
    annual_site_count: String(possibleAssessment.annual_site_count ?? ""),
    property_type: String(possibleAssessment.property_type ?? ""),
    trained_consultants: String(possibleAssessment.trained_consultants ?? ""),
    setup_people: String(possibleAssessment.setup_people ?? ""),
    steady_team_members: String(possibleAssessment.steady_team_members ?? ""),
    company_scale: String(possibleAssessment.company_scale ?? ""),
    pr_platform: String(possibleAssessment.pr_platform ?? ""),
    networking: String(possibleAssessment.networking ?? ""),
    monthly_ad_budget: String(possibleAssessment.monthly_ad_budget ?? ""),
    ad_operation: String(possibleAssessment.ad_operation ?? ""),
    ad_budget_support: String(possibleAssessment.ad_budget_support ?? ""),
  };
}

export function parseGradeAssessmentBlock(
  memo: string | null | undefined,
): GradeAssessmentForm {
  const raw = String(memo ?? "");

  const exactMatched = raw.match(new RegExp(`${START}([\\s\\S]*?)${END}`));
  const legacyMatched =
    exactMatched ||
    raw.match(/\[\[CRM_GRADE_ASSESSMENT\]\]([\s\S]*?)(?:\[\[\/CRM_GRADE_ASSESSMENT\]\]|$)/) ||
    raw.match(/\[\[CRM_GRADE_ASSENSSMENT\]\]([\s\S]*?)(?:\[\[\/CRM_GRADE_ASSENSSMENT\]\]|$)/) ||
    raw.match(/\[\[CRM_GRADE_ASSESSMEN[^\]]*\]\]([\s\S]*?)(?:\[\[\/CRM_GRADE_ASSESSMEN[^\]]*\]\]|$)/) ||
    raw.match(/\[\[CRM_GRADE_ASSENSSMEN[^\]]*\]\]([\s\S]*?)(?:\[\[\/CRM_GRADE_ASSENSSMEN[^\]]*\]\]|$)/);

  const jsonText = legacyMatched?.[1]?.trim();

  if (!jsonText) {
    return { ...EMPTY_GRADE_ASSESSMENT };
  }

  try {
    return safeAssessmentFromParsed(JSON.parse(jsonText));
  } catch {
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!objectMatch?.[0]) {
      return { ...EMPTY_GRADE_ASSESSMENT };
    }

    try {
      return safeAssessmentFromParsed(JSON.parse(objectMatch[0]));
    } catch {
      return { ...EMPTY_GRADE_ASSESSMENT };
    }
  }
}
