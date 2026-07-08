"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const REGIONS = [
  "모든지역",
  "서울",
  "경기남부",
  "경기북부",
  "인천",
  "부산",
  "울산",
  "대구",
  "경상도",
  "대전",
  "세종",
  "충청도",
  "광주",
  "전라도",
  "강원도",
  "제주도",
];

const ASSIGNEES = ["", "조계현", "이세호", "기여운", "최연전"];

const SECTION_ORDER = [
  "유니크",
  "슈페리어",
  "프리미엄",
  "전국TOP",
  "일반구인글",
];

type BunyanglineRow = {
  id?: string | number;
  region_name?: string | null;
  list_region_name?: string | null;
  ad_section?: string | null;
  site_name?: string | null;
  posted_at?: string | null;
  posted_datetime?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  agency_company?: string | null;
  apartment_fee?: string | null;
  move_in_date?: string | null;
  source_url?: string | null;
  source_id?: string | null;
  title?: string | null;
  summary?: string | null;
  site_address?: string | null;
  work_address?: string | null;
  category?: string | null;
  detail_text?: string | null;
  raw_text?: string | null;
  assigned_to?: string | null;
  is_new?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type ApiResponse = {
  ok?: boolean;
  count?: number;
  data?:
    | BunyanglineRow[]
    | {
        data?: BunyanglineRow[];
        rows?: BunyanglineRow[];
        items?: BunyanglineRow[];
      };
  rows?: BunyanglineRow[];
  items?: BunyanglineRow[];
  result?: BunyanglineRow[];
  records?: BunyanglineRow[];
  message?: string;
  error?: string;
  [key: string]: unknown;
};

function pickRowsFromPayload(payload: unknown): BunyanglineRow[] {
  if (Array.isArray(payload)) return payload as BunyanglineRow[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.data,
    record.rows,
    record.items,
    record.result,
    record.records,
    typeof record.data === "object" && record.data
      ? (record.data as Record<string, unknown>).data
      : undefined,
    typeof record.data === "object" && record.data
      ? (record.data as Record<string, unknown>).rows
      : undefined,
    typeof record.data === "object" && record.data
      ? (record.data as Record<string, unknown>).items
      : undefined,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as BunyanglineRow[];
  }

  return [];
}

function payloadKeys(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return [];
  return Object.keys(payload as Record<string, unknown>);
}

function value(row: BunyanglineRow, ...keys: string[]) {
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined) continue;
    const text = String(raw).trim();
    if (text) return text;
  }
  return "";
}

function formatDate(text: string) {
  if (!text) return "-";
  const normalized = text.replace("T", " ").slice(0, 10);
  return normalized || "-";
}

function formatPhone(text: string) {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith("02")) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return text || "-";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function BunyanglineDataPage() {
  const [rows, setRows] = useState<BunyanglineRow[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("모든지역");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [apiDebug, setApiDebug] = useState("");
  const [selectedRow, setSelectedRow] = useState<BunyanglineRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      // 화면에서는 지역 필터를 API로 넘기지 않고, 전체 데이터를 받은 뒤 프론트에서 필터링합니다.
      // 이렇게 해야 region=울산처럼 특정 지역 값이 0건일 때도 전체 데이터 로딩 자체는 정상인지 바로 확인할 수 있습니다.
      const params = new URLSearchParams({
        limit: "5000",
        _t: String(Date.now()),
      });

      const apiUrl = `/api/bunyangline-data/list?${params.toString()}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      const rawText = await response.text();
      let result: ApiResponse | BunyanglineRow[] | null = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch {
        result = null;
      }

      console.log("[분양라인데이터 전체 조회결과]", {
        apiUrl,
        status: response.status,
        responseOk: response.ok,
        payloadKeys: payloadKeys(result),
        payloadCount:
          result && typeof result === "object" && !Array.isArray(result)
            ? (result as ApiResponse).count
            : undefined,
        sample: pickRowsFromPayload(result)[0],
        result,
      });

      if (!response.ok) {
        throw new Error(
          (result &&
            typeof result === "object" &&
            !Array.isArray(result) &&
            ((result as ApiResponse).error ||
              (result as ApiResponse).message)) ||
            rawText.slice(0, 300) ||
            `조회 실패 status=${response.status}`,
        );
      }

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        (result as ApiResponse).ok === false
      ) {
        throw new Error(
          (result as ApiResponse).error ||
            (result as ApiResponse).message ||
            "조회 API가 ok=false를 반환했습니다.",
        );
      }

      const nextRows = pickRowsFromPayload(result);
      setRows(nextRows);
      setApiDebug(
        `API ${response.status} · url=${apiUrl} · keys=${payloadKeys(result).join(",") || "-"} · apiCount=${result && typeof result === "object" && !Array.isArray(result) ? ((result as ApiResponse).count ?? "-") : "-"} · loadedRows=${nextRows.length}`,
      );
      setLastLoadedAt(new Date().toLocaleString("ko-KR"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[분양라인데이터 조회오류]", message);
      setErrorMessage(message);
      setApiDebug(`조회 오류: ${message}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedRegion("모든지역");
    setKeyword("");
    void fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      const rowRegion = value(row, "region_name", "list_region_name");
      const regionMatched =
        selectedRegion === "모든지역" || rowRegion === selectedRegion;
      if (!regionMatched) return false;

      if (!normalizedKeyword) return true;

      const searchable = [
        "region_name",
        "list_region_name",
        "ad_section",
        "site_name",
        "title",
        "manager_name",
        "manager_phone",
        "agency_company",
        "apartment_fee",
        "move_in_date",
        "assigned_to",
        "site_address",
        "work_address",
        "category",
        "summary",
        "detail_text",
      ]
        .map((key) => value(row, key))
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedKeyword);
    });
  }, [keyword, rows, selectedRegion]);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of visibleRows) {
      const section = value(row, "ad_section") || "미지정";
      counts[section] = (counts[section] || 0) + 1;
    }
    return counts;
  }, [visibleRows]);

  function handleRegionClick(region: string) {
    setSelectedRegion(region);
  }

  function handleSearch() {
    // 검색어는 입력 즉시 상태에 반영되어 있으므로 별도 API 호출 없이 화면에서 필터링됩니다.
  }

  function resetFilters() {
    setKeyword("");
    setSelectedRegion("모든지역");
  }

  async function updateAssignee(row: BunyanglineRow, assignedTo: string) {
    const id = value(row, "id");
    if (!id) {
      alert("저장할 데이터 ID가 없습니다.");
      return;
    }

    const previousRows = rows;
    setRows((current) =>
      current.map((item) =>
        String(item.id) === String(id)
          ? { ...item, assigned_to: assignedTo || null }
          : item,
      ),
    );

    try {
      const response = await fetch("/api/bunyangline-data/assign", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assigned_to: assignedTo }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.message || "담당자 저장 실패");
      }
    } catch (error) {
      setRows(previousRows);
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  function downloadCsv() {
    const headers = [
      "지역",
      "게재지면",
      "현장명",
      "등록일",
      "담당자이름",
      "담당자연락처",
      "대행사",
      "아파트분양",
      "투입일",
      "배정담당자",
      "사업지주소",
      "근무지주소",
      "원본공고",
    ];

    const lines = [
      headers.map(escapeCsv).join(","),
      ...visibleRows.map((row) =>
        [
          value(row, "region_name"),
          value(row, "ad_section"),
          value(row, "site_name", "title"),
          value(row, "posted_at", "posted_datetime"),
          value(row, "manager_name"),
          value(row, "manager_phone"),
          value(row, "agency_company"),
          value(row, "apartment_fee"),
          value(row, "move_in_date"),
          value(row, "assigned_to"),
          value(row, "site_address"),
          value(row, "work_address"),
          value(row, "source_url"),
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ];

    const blob = new Blob([`\ufeff${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `분양라인데이터_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-6 text-slate-100 md:px-8">
      <section className="mx-auto max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              분양라인데이터
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              분양라인 지역별 구인공고 중 2026년 7월 1일 이후 실제 등록된
              데이터를 누적하고, 담당자 연락처 중복 여부를 확인합니다.
            </p>
            <div className="mt-3 inline-flex rounded-full border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-xs font-black text-violet-200">
              수집 기준: 2026.07.01 이후 ·
              유니크/슈페리어/프리미엄/전국TOP/일반구인글 · 원본공고 링크 기준
              누적 저장
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-xl border border-emerald-500/50 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-500/10"
            >
              엑셀 다운로드
            </button>
            <button
              type="button"
              onClick={() => fetchRows()}
              className="rounded-xl border border-white/15 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-200 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "조회중" : "새로고침"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#141416] p-4 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => handleRegionClick(region)}
                className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                  selectedRegion === region
                    ? "border-violet-400 bg-violet-500 text-white shadow-lg shadow-violet-950/40"
                    : "border-white/15 bg-[#101012] text-slate-200 hover:border-violet-400/70 hover:bg-violet-500/10"
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSearch();
              }}
              placeholder="현장명 / 담당자 / 연락처 / 대행사 / 지면 / 배정담당자 검색"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0c0c0e] px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="h-11 rounded-xl bg-violet-500 px-6 text-sm font-black text-white hover:bg-violet-400 disabled:opacity-50"
              disabled={loading}
            >
              검색
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-11 rounded-xl border border-white/15 px-5 text-sm font-black text-slate-300 hover:bg-white/5 disabled:opacity-50"
              disabled={loading}
            >
              필터해제
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            조회 오류: {errorMessage}
          </div>
        ) : null}

        {apiDebug ? (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs font-bold text-blue-100">
            조회 디버그: {apiDebug}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#141416] p-5">
            <p className="text-xs font-black text-slate-400">현재 출력건수</p>
            <p className="mt-2 text-3xl font-black text-white">
              {visibleRows.length.toLocaleString("ko-KR")}건
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              전체 로딩: {rows.length.toLocaleString("ko-KR")}건
            </p>
            {lastLoadedAt ? (
              <p className="mt-2 text-xs font-bold text-slate-500">
                마지막 조회: {lastLoadedAt}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#141416] p-5">
            <p className="text-xs font-black text-slate-400">선택 지역</p>
            <p className="mt-2 text-2xl font-black text-white">
              {selectedRegion}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#141416] p-5">
            <p className="text-xs font-black text-slate-400">게재지면 현황</p>
            <p className="mt-3 text-sm font-black text-white">
              {SECTION_ORDER.map(
                (section) => `${section} ${sectionCounts[section] || 0}개`,
              ).join(" · ")}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
          <div className="max-h-[68vh] overflow-auto">
            <table className="min-w-[1700px] w-full border-collapse text-center text-sm">
              <thead className="sticky top-0 z-10 bg-[#1b1b1f] text-xs font-black text-blue-200">
                <tr>
                  <th className="px-3 py-3">지역</th>
                  <th className="px-3 py-3">게재지면</th>
                  <th className="px-3 py-3">현장명</th>
                  <th className="px-3 py-3">등록일</th>
                  <th className="px-3 py-3">담당자이름</th>
                  <th className="px-3 py-3">담당자 연락처</th>
                  <th className="px-3 py-3">대행사</th>
                  <th className="px-3 py-3">아파트 분양</th>
                  <th className="px-3 py-3">투입일</th>
                  <th className="px-3 py-3">담당자</th>
                  <th className="px-3 py-3">상세정보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center font-bold text-slate-400"
                    >
                      데이터를 불러오는 중입니다.
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center font-bold text-slate-400"
                    >
                      표시할 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, index) => {
                    const rowId =
                      value(row, "id") ||
                      `${value(row, "source_url")}-${index}`;
                    const siteName = value(row, "site_name", "title") || "-";
                    const sourceUrl = value(row, "source_url");
                    const isNew = Boolean(row.is_new);

                    return (
                      <tr key={rowId} className="hover:bg-white/[0.035]">
                        <td className="px-3 py-3 font-black text-slate-200">
                          {value(row, "region_name") || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-xs font-black text-violet-200">
                            {value(row, "ad_section") || "-"}
                          </span>
                        </td>
                        <td className="max-w-[320px] px-3 py-3 text-left font-black text-white">
                          <div className="flex items-center gap-2">
                            {isNew ? (
                              <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                NEW
                              </span>
                            ) : null}
                            {sourceUrl ? (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="line-clamp-2 hover:text-violet-300 hover:underline"
                              >
                                {siteName}
                              </a>
                            ) : (
                              <span className="line-clamp-2">{siteName}</span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                            {value(row, "site_address", "work_address")}
                          </p>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-300">
                          {formatDate(
                            value(row, "posted_at", "posted_datetime"),
                          )}
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-200">
                          {value(row, "manager_name") || "-"}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-bold text-slate-200">
                          {formatPhone(value(row, "manager_phone"))}
                        </td>
                        <td className="max-w-[180px] px-3 py-3 font-bold text-slate-300">
                          <span className="line-clamp-2">
                            {value(row, "agency_company") || "-"}
                          </span>
                        </td>
                        <td className="max-w-[180px] px-3 py-3 font-bold text-slate-300">
                          <span className="line-clamp-2">
                            {value(row, "apartment_fee") || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-300">
                          {value(row, "move_in_date") || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={value(row, "assigned_to")}
                            onChange={(event) =>
                              updateAssignee(row, event.target.value)
                            }
                            className="h-9 rounded-lg border border-white/10 bg-[#0b0b0d] px-2 text-xs font-black text-white outline-none focus:border-violet-400"
                          >
                            {ASSIGNEES.map((name) => (
                              <option key={name || "empty"} value={name}>
                                {name || "미배정"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedRow(row)}
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-black text-slate-200 hover:border-violet-400 hover:text-violet-200"
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#151518] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-black text-violet-300">
                  {value(selectedRow, "ad_section")} ·{" "}
                  {value(selectedRow, "region_name")}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {value(selectedRow, "site_name", "title") || "-"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {value(selectedRow, "site_address", "work_address")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/5"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[68vh] overflow-auto p-5">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info
                  label="등록일"
                  value={formatDate(
                    value(selectedRow, "posted_at", "posted_datetime"),
                  )}
                />
                <Info
                  label="담당자"
                  value={`${value(selectedRow, "manager_name") || "-"} / ${formatPhone(value(selectedRow, "manager_phone"))}`}
                />
                <Info
                  label="대행사"
                  value={value(selectedRow, "agency_company") || "-"}
                />
                <Info
                  label="아파트 분양"
                  value={value(selectedRow, "apartment_fee") || "-"}
                />
                <Info
                  label="투입일"
                  value={value(selectedRow, "move_in_date") || "-"}
                />
                <Info
                  label="배정담당자"
                  value={value(selectedRow, "assigned_to") || "미배정"}
                />
              </div>

              {value(selectedRow, "source_url") ? (
                <a
                  href={value(selectedRow, "source_url")}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-xl border border-violet-400/40 px-4 py-2 text-sm font-black text-violet-200 hover:bg-violet-500/10"
                >
                  원본공고 열기
                </a>
              ) : null}

              <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
                <p className="mb-3 text-sm font-black text-slate-300">
                  상세정보
                </p>
                <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">
                  {value(selectedRow, "detail_text", "summary", "raw_text") ||
                    "상세정보가 없습니다."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-100">{value}</p>
    </div>
  );
}
