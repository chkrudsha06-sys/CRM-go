import { NextResponse } from "next/server";

const SHEET_ID = "1BMTKBgos_Tsz8Cdsf8gHomrVNqp7G0vdTGrqW5fGkW8";
const GID = "516579075";

// gviz endpoint (works if sheet is publicly viewable)
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
// export endpoint (fallback)
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

interface AdSite {
  region: string;
  city: string;
  siteName: string;
  performance: string;
  support: string;
  totalAdBudget: number;
  operatingAmount: number;
  reservationAmount: number;
  adCount: number;
  customers: string[];
  suspended: boolean;
  suspendedDate: string;
  competition: "심화" | "적정" | "보통" | "여유";
}

function parseAmount(s: string): number {
  if (!s || s === "-" || s === "") return 0;
  return Number(s.replace(/[₩,원\s]/g, "")) || 0;
}

function classifyCompetition(adCount: number, totalBudget: number): "심화" | "적정" | "보통" | "여유" {
  if (adCount >= 5 || totalBudget >= 30000000) return "심화";
  if (adCount >= 3 || totalBudget >= 15000000) return "적정";
  if (adCount >= 2 || totalBudget >= 5000000) return "보통";
  return "여유";
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

function extractSitesFromBlock(rows: string[][], colOffset: number): AdSite[] {
  const sites: AdSite[] = [];
  let currentRegion = "";

  for (const cols of rows) {
    const region = (cols[colOffset + 0] || "").trim();
    const city = (cols[colOffset + 2] || "").trim();
    const siteName = (cols[colOffset + 4] || "").trim();

    if (!siteName || siteName === "현장명" || siteName.includes("⭐") || siteName.includes("✨")) continue;

    if (region) currentRegion = region;
    if (!currentRegion || !siteName) continue;

    const totalAdBudget = parseAmount(cols[colOffset + 12] || "");
    const operatingAmount = parseAmount(cols[colOffset + 15] || "");
    const reservationAmount = parseAmount(cols[colOffset + 18] || "");
    const adCount = Number(cols[colOffset + 21] || "0") || 0;

    const customers: string[] = [];
    [23, 26, 29, 32].forEach(off => {
      const c = (cols[colOffset + off] || "").trim();
      if (c && c !== "-") customers.push(c);
    });

    const suspendedStr = (cols[colOffset + 35] || "").trim();
    const suspendedDate = (cols[colOffset + 37] || "").trim();
    const suspended = suspendedStr !== "" && suspendedStr !== "-";

    if (totalAdBudget === 0 && adCount === 0) continue;

    sites.push({
      region: currentRegion,
      city: city || currentRegion,
      siteName,
      performance: (cols[colOffset + 10] || "").trim(),
      support: (cols[colOffset + 11] || "").trim(),
      totalAdBudget,
      operatingAmount,
      reservationAmount,
      adCount,
      customers,
      suspended,
      suspendedDate,
      competition: classifyCompetition(adCount, totalAdBudget),
    });
  }
  return sites;
}

export async function GET(req: Request) {
  try {
    let csvText = "";
    const fetchErrors: string[] = [];

    // gviz → export 순으로 시도 (광고내역기록과 동일 패턴)
    for (const url of [GVIZ_URL, EXPORT_URL]) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const text = await res.text();
          if (text.split("\n").length > 1 && !text.includes("<!DOCTYPE")) {
            csvText = text;
            break;
          } else {
            fetchErrors.push(`${url.includes("gviz") ? "gviz" : "export"}: OK but invalid (${text.length}chars, lines=${text.split("\\n").length})`);
          }
        } else {
          fetchErrors.push(`${url.includes("gviz") ? "gviz" : "export"}: HTTP ${res.status}`);
        }
      } catch (e: any) {
        fetchErrors.push(`${url.includes("gviz") ? "gviz" : "export"}: ${e.message}`);
      }
    }

    if (!csvText) {
      return NextResponse.json({ 
        error: `시트 데이터를 불러올 수 없습니다. (${fetchErrors.join(" | ")})`, 
        sites: [] 
      }, { status: 200 });
    }

    const lines = csvText.split("\n").map(l => parseCSVLine(l));

    // Find header rows (look for "지역" pattern)
    const headerIndices: { row: number; col: number }[] = [];
    lines.forEach((cols, rowIdx) => {
      cols.forEach((cell, colIdx) => {
        if (cell === "지역" && cols[colIdx + 2]?.trim() === "도시" && cols[colIdx + 4]?.trim() === "현장명") {
          headerIndices.push({ row: rowIdx, col: colIdx });
        }
      });
    });

    const allSites: AdSite[] = [];

    // Group headers by row (same row = side-by-side blocks)
    const rowGroups = new Map<number, number[]>();
    headerIndices.forEach(h => {
      const existing = rowGroups.get(h.row) || [];
      existing.push(h.col);
      rowGroups.set(h.row, existing);
    });

    for (const entry of Array.from(rowGroups.entries())) {
      const headerRow = entry[0];
      const colOffsets = entry[1];
      // Find next header row to determine data range
      const sortedHeaderRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);
      const nextHeaderIdx = sortedHeaderRows.indexOf(headerRow) + 1;
      const endRow = nextHeaderIdx < sortedHeaderRows.length ? sortedHeaderRows[nextHeaderIdx] - 2 : lines.length;
      const dataRows = lines.slice(headerRow + 1, endRow);

      for (const colOffset of colOffsets) {
        const sites = extractSitesFromBlock(dataRows, colOffset);
        allSites.push(...sites);
      }
    }

    // Summary stats
    const totalBudget = allSites.reduce((s, a) => s + a.totalAdBudget, 0);
    const totalOperating = allSites.reduce((s, a) => s + a.operatingAmount, 0);
    const totalReservation = allSites.reduce((s, a) => s + a.reservationAmount, 0);
    const totalOutstanding = totalBudget - totalOperating;

    return NextResponse.json({
      sites: allSites,
      summary: {
        totalSites: allSites.length,
        totalBudget,
        totalOperating,
        totalReservation,
        totalOutstanding,
        totalAdUsers: allSites.reduce((s, a) => s + a.adCount, 0),
      },
      lastSync: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "알 수 없는 오류", sites: [] }, { status: 200 });
  }
}
