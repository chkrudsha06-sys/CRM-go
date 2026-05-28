import { NextResponse } from "next/server";

const SHEET_ID = "1TmBP2k54P-XkS3X5z0tKMRFSfjB5SvQG0AFG9d8OfUo";
const TABS = [
  { label: "2026", gid: "2076389318" },
  { label: "2025", gid: "1713049245" },
];

interface Campaign {
  물건: string; 광고기간: string; 광고기간원본: string; 지역: string;
  현장명원본: string; 현장명: string; 캠페인번호: string;
  광고주: string; 광고비: number; 담당자: string;
  분류: string; 물건분류: string; 콜: number; 관심: number;
  연도: string; 정렬키: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(s: string): number {
  if (!s) return 0;
  return Number(s.replace(/[₩,원\s]/g, "")) || 0;
}

function parseSiteName(name: string): { base: string; campaign: string } {
  const match = name.match(/^(.+?)(\d+(?:_\d+)?)$/);
  if (match) return { base: match[1], campaign: match[2] };
  return { base: name, campaign: "1" };
}

// 광고기간 연도 계산 (시작-종료 관계 기반)
// 광고기간 연도 계산
// 탭 "2025" = 2025년도에 운영된 캠페인 데이터
// 유일한 예외: 시작월 > 종료월 (년도 넘김) → 시작은 전년도
// "12/20-1/5" (2025탭) → 24.12.20 ~ 25.01.05 (년도 넘김)
// "8/19-9/11" (2025탭) → 25.08.19 ~ 25.09.11 (2025년 내)
// "1/3-1/22" (2025탭) → 25.01.03 ~ 25.01.22 (2025년 내)
function formatPeriod(period: string, tabYear: string): { display: string; sortKey: string } {
  if (!period) return { display: "-", sortKey: "9999-99-99" };
  const yr = parseInt(tabYear);
  const parts = period.split("-");
  if (parts.length !== 2) return { display: period, sortKey: "9999-99-99" };

  const [sm, sd] = parts[0].trim().split("/").map(Number);
  const [em, ed] = parts[1].trim().split("/").map(Number);
  if (!sm || !sd || !em || !ed) return { display: period, sortKey: "9999-99-99" };

  let startYear: number, endYear: number;

  if (sm > em) {
    // 년도 넘김 (12→1, 11→2 등): 시작만 전년도
    startYear = yr - 1;
    endYear = yr;
  } else {
    // 같은 해: 모두 탭 연도
    startYear = yr;
    endYear = yr;
  }

  const fmt = (y: number, m: number, d: number) =>
    `${String(y).slice(2)}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
  const sortFmt = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return {
    display: `${fmt(startYear, sm, sd)} ~ ${fmt(endYear, em, ed)}`,
    sortKey: sortFmt(startYear, sm, sd),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const yearFilter = url.searchParams.get("year") || "all";
    const allCampaigns: Campaign[] = [];
    const errors: string[] = [];

    for (const tab of TABS) {
      if (yearFilter !== "all" && tab.label !== yearFilter) continue;

      // gviz → export 순으로 시도
      const urls = [
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`,
      ];

      let csvText = "";
      for (const csvUrl of urls) {
        try {
          const res = await fetch(csvUrl, { cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            if (text.split("\n").length > 1 && !text.includes("<!DOCTYPE")) {
              csvText = text;
              break;
            }
          }
        } catch {}
      }

      if (!csvText) {
        errors.push(`${tab.label}탭 데이터를 가져올 수 없습니다.`);
        continue;
      }

      const lines = csvText.split("\n").map(l => parseCSVLine(l));

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i];
        if (!cols || cols.length < 10 || !cols[3]) continue;

        const rawName = cols[3];
        const { base, campaign } = parseSiteName(rawName);
        const { display, sortKey } = formatPeriod(cols[1] || "", tab.label);

        allCampaigns.push({
          물건: cols[0] || "",
          광고기간: display,
          광고기간원본: cols[1] || "",
          지역: cols[2] || "",
          현장명원본: rawName,
          현장명: base,
          캠페인번호: campaign,
          광고주: cols[4] || "",
          광고비: parseAmount(cols[5]),
          담당자: cols[6] || "",
          분류: cols[7] || "",
          물건분류: cols[8] || "",
          콜: Number(cols[9]) || 0,
          관심: Number(cols[10]) || 0,
          연도: tab.label,
          정렬키: sortKey,
        });
      }
    }

    // 현장별 그룹핑
    const siteMap = new Map<string, Campaign[]>();
    for (const c of allCampaigns) {
      if (!siteMap.has(c.현장명)) siteMap.set(c.현장명, []);
      siteMap.get(c.현장명)!.push(c);
    }

    const sites = Array.from(siteMap.entries()).map(([name, campaigns]) => {
      // ★ 광고기간 오름차순 정렬 (먼저 진행된 캠페인이 위로)
      campaigns.sort((a, b) => a.정렬키.localeCompare(b.정렬키));

      const totalCalls = campaigns.reduce((s, c) => s + c.콜, 0);
      const totalInterest = campaigns.reduce((s, c) => s + c.관심, 0);
      const totalBudget = campaigns.reduce((s, c) => s + c.광고비, 0);
      const regions = Array.from(new Set(campaigns.map(c => c.지역)));

      return {
        현장명: name,
        지역: regions.join(", "),
        캠페인수: campaigns.length,
        총콜: totalCalls,
        총관심: totalInterest,
        총광고비: totalBudget,
        물건: campaigns[0]?.물건 || "",
        물건분류: campaigns[0]?.물건분류 || "",
        캠페인: campaigns,
      };
    });

    sites.sort((a, b) => b.캠페인수 - a.캠페인수 || b.총콜 - a.총콜);

    return NextResponse.json({
      sites,
      summary: {
        totalSites: sites.length,
        totalCampaigns: allCampaigns.length,
        totalCalls: allCampaigns.reduce((s, c) => s + c.콜, 0),
        totalInterest: allCampaigns.reduce((s, c) => s + c.관심, 0),
        totalBudget: allCampaigns.reduce((s, c) => s + c.광고비, 0),
      },
      errors: errors.length > 0 ? errors : undefined,
      lastSync: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "알 수 없는 오류", sites: [] }, { status: 200 });
  }
}
