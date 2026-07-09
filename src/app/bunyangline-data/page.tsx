'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type React from 'react';

const REGIONS = [
  '모든지역',
  '서울',
  '경기남부',
  '경기북부',
  '인천',
  '부산',
  '울산',
  '대구',
  '경상도',
  '대전',
  '세종',
  '충청도',
  '광주',
  '전라도',
  '강원도',
  '제주도',
];

const ASSIGNEES = ['조계현', '이세호', '기여운', '최연전'];
const SECTION_NAMES = ['유니크', '슈페리어', '프리미엄', '전국TOP', '일반구인글'] as const;

type BunyanglineRow = {
  id: number | string;
  region_name: string | null;
  ad_section: string | null;
  site_name: string | null;
  resolved_site_name: string | null;
  unit_count: string | null;
  complex_count: string | null;
  unit_count_source: string | null;
  unit_count_confidence: number | null;
  posted_at: string | null;
  posted_datetime: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_phone_duplicate_count?: number;
  manager_phone_is_duplicate?: boolean;
  agency_company: string | null;
  apartment_fee: string | null;
  move_in_date: string | null;
  source_url: string | null;
  assigned_to: string | null;
  detail_text: string | null;
  title: string | null;
  summary: string | null;
  site_address: string | null;
  work_address: string | null;
  category: string | null;
  crawled_at: string | null;
  created_at: string | null;
};

function emptyText(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function normalizeAdSection(value: string | null | undefined) {
  const text = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  if (text.includes('unique') || text.includes('유니크')) return '유니크';
  if (text.includes('superior') || text.includes('슈페리어')) return '슈페리어';
  if (text.includes('premium') || text.includes('프리미엄')) return '프리미엄';
  if (text.includes('전국top') || text.includes('전국탑') || text.includes('nationaltop')) return '전국TOP';
  return '일반구인글';
}

function sectionSummaryText(counts: Record<string, number>) {
  return SECTION_NAMES.map((name) => `${name} ${Number(counts[name] || 0).toLocaleString()}개`).join(' · ');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value;
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

function formatPhone(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '-';

  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length === 11 && /^01[016789]/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && /^01[016789]/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 10 && digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 9 && digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;

  return raw || '-';
}

function truncate(value: string | null | undefined, length = 28) {
  const text = emptyText(value);
  if (text === '-') return text;
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function xmlEscape(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeExcelText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim() || '-';
}

function excelCell(value: string | null | undefined, styleId = 'Text') {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${xmlEscape(normalizeExcelText(value))}</Data></Cell>`;
}

function downloadRowsAsExcel(rows: BunyanglineRow[], selectedRegion: string) {
  const headers = ['지역', '게재지면', '현장명', '대표현장명', '세대수', '단지수', '등록일', '담당자이름', '담당자 연락처', '대행사', '아파트 분양', '투입일', '원본공고링크', '담당자', '상세정보'];
  const columnWidths = [80, 90, 220, 220, 90, 90, 90, 110, 130, 220, 190, 90, 260, 100, 360];

  const headerRow = `<Row>${headers.map((header) => excelCell(header, 'Header')).join('')}</Row>`;
  const bodyRows = rows
    .map((row) => {
      const cells = [
        emptyText(row.region_name),
        normalizeAdSection(row.ad_section),
        emptyText(row.site_name),
        emptyText(row.resolved_site_name),
        emptyText(row.unit_count),
        emptyText(row.complex_count),
        formatDate(row.posted_at || row.posted_datetime),
        emptyText(row.manager_name),
        formatPhone(row.manager_phone),
        emptyText(row.agency_company),
        emptyText(row.apartment_fee),
        emptyText(row.move_in_date),
        emptyText(row.source_url),
        emptyText(row.assigned_to),
        emptyText(row.detail_text),
      ];

      return `<Row>${cells.map((cell, index) => excelCell(cell, index === 14 ? 'Detail' : 'Text')).join('')}</Row>`;
    })
    .join('');

  const worksheet = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="Detail">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="분양라인데이터">
    <Table>
      ${columnWidths.map((width) => `<Column ss:Width="${width}"/>`).join('')}
      ${headerRow}
      ${bodyRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const safeRegion = selectedRegion.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `분양라인데이터_${safeRegion}_${y}${m}${d}.xls`;
  const blob = new Blob([worksheet], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BunyanglineDataPage() {
  const [selectedRegion, setSelectedRegion] = useState('모든지역');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<BunyanglineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [openedId, setOpenedId] = useState<string | number | null>(null);
  const [assignSavingId, setAssignSavingId] = useState<string | number | null>(null);

  const filterActive = selectedRegion !== '모든지역' || keyword.trim() !== '';

  const sectionCounts = useMemo(() => {
    const base = SECTION_NAMES.reduce<Record<string, number>>((acc, name) => {
      acc[name] = 0;
      return acc;
    }, {});

    return rows.reduce<Record<string, number>>((acc, row) => {
      const key = normalizeAdSection(row.ad_section);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, base);
  }, [rows]);

  async function fetchRows(nextRegion = selectedRegion, nextKeyword = keyword) {
    setLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams({
        region: nextRegion,
        keyword: nextKeyword,
        limit: '5000',
      });

      const response = await fetch(`/api/bunyangline-data/list?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || result?.message || '조회 실패');
      }

      setRows(result.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSelectedRegion('모든지역');
    setKeyword('');
    setOpenedId(null);
    void fetchRows('모든지역', '');
  }

  async function updateAssignee(rowId: string | number, assignedTo: string) {
    const previousRows = rows;
    setAssignSavingId(rowId);
    setErrorMessage('');

    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, assigned_to: assignedTo || null } : row)));

    try {
      const response = await fetch('/api/bunyangline-data/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ id: rowId, assigned_to: assignedTo || null }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || result?.message || '담당자 저장 실패');
    } catch (error) {
      setRows(previousRows);
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      alert(`담당자 저장 실패: ${message}`);
    } finally {
      setAssignSavingId(null);
    }
  }

  function openSourcePopup(sourceUrl: string | null | undefined) {
    if (!sourceUrl) return;

    const width = 1180;
    const height = 860;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    const popup = window.open(
      sourceUrl,
      'bunyangline-original-post',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      alert('팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 눌러주세요.');
      return;
    }

    popup.focus();
  }

  useEffect(() => {
    void fetchRows(selectedRegion, keyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  return (
    <main style={pageStyle}>
      <section style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={titleStyle}>분양라인데이터</h1>
            <p style={subtitleStyle}>분양라인 지역현장 구인공고 중 2026년 7월 1일 이후 실제 등록된 데이터를 누적하고, 담당자 연락처 중복 여부를 확인합니다.</p>
            <div style={noticeStyle}>수집 기준: 2026.07.01 이후 · 유니크/슈페리어/프리미엄/전국TOP/일반구인글 · 원본공고 링크 기준 누적 저장</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => downloadRowsAsExcel(rows, selectedRegion)} disabled={rows.length === 0 || loading} style={excelButtonStyle(rows.length === 0 || loading)}>
              엑셀 다운로드
            </button>
            <button type="button" onClick={() => fetchRows()} disabled={loading} style={secondaryButtonStyle(loading)}>
              {loading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={regionWrapStyle}>
          {REGIONS.map((region) => {
            const active = selectedRegion === region;
            return (
              <button key={region} type="button" onClick={() => setSelectedRegion(region)} style={regionButtonStyle(active)}>
                {region}
              </button>
            );
          })}
        </div>

        <div style={searchRowStyle}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void fetchRows(selectedRegion, keyword);
            }}
            placeholder="현장명 / 담당자 / 연락처 / 대행사 / 지면 / 배정담당자 검색"
            style={searchInputStyle}
          />
          <button type="button" onClick={() => fetchRows(selectedRegion, keyword)} disabled={loading} style={primaryButtonStyle(loading)}>
            검색
          </button>
          <button type="button" onClick={resetFilters} disabled={!filterActive && !loading} style={secondaryButtonStyle(!filterActive && !loading)}>
            필터해제
          </button>
        </div>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}
      </section>

      <section style={summaryGridStyle}>
        <SummaryCard label="현재 출력건수" value={`${rows.length.toLocaleString()}건`} />
        <SummaryCard label="선택 지역" value={selectedRegion} />
        <SummaryCard label="게재지면 현황" value={sectionSummaryText(sectionCounts)} small />
      </section>

      <section style={tablePanelStyle}>
        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>지역</Th>
                <Th>게재지면</Th>
                <Th>현장명</Th>
                <Th>세대수</Th>
                <Th>등록일</Th>
                <Th>담당자이름</Th>
                <Th>담당자 연락처</Th>
                <Th>대행사</Th>
                <Th>아파트 분양</Th>
                <Th>투입일</Th>
                <Th>원본공고링크</Th>
                <Th>담당자</Th>
                <Th>상세정보</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={emptyCellStyle}>데이터를 불러오는 중입니다.</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} style={emptyCellStyle}>표시할 데이터가 없습니다.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const opened = openedId === row.id;
                  const sectionLabel = normalizeAdSection(row.ad_section);
                  const displaySiteName = row.site_name;
                  const siteNameTitle = row.resolved_site_name && row.site_name && row.resolved_site_name !== row.site_name
                    ? `원본현장명: ${row.site_name}\n추출현장명: ${row.resolved_site_name}`
                    : emptyText(displaySiteName);
                  const unitCountTitle = [
                    row.unit_count ? `세대수: ${row.unit_count}` : '',
                    row.complex_count ? `단지수: ${row.complex_count}` : '',
                    row.unit_count_source ? `출처: ${row.unit_count_source}` : '',
                    row.unit_count_confidence ? `신뢰도: ${row.unit_count_confidence}` : '',
                  ].filter(Boolean).join('\n');
                  return (
                    <Fragment key={row.id}>
                      <tr style={opened ? openedRowStyle : undefined}>
                        <Td>{emptyText(row.region_name)}</Td>
                        <Td><span style={sectionBadgeStyle(sectionLabel)}>{sectionLabel}</span></Td>
                        <Td title={siteNameTitle}>
                          <strong>{truncate(displaySiteName, 24)}</strong>
                        </Td>
                        <Td title={unitCountTitle || undefined}>
                          {row.unit_count ? <span style={unitCountBadgeStyle}>{row.unit_count}</span> : null}
                          {row.complex_count ? <span style={complexCountBadgeStyle}>{row.complex_count}</span> : null}
                          {!row.unit_count && !row.complex_count ? '-' : null}
                        </Td>
                        <Td>{formatDate(row.posted_at || row.posted_datetime)}</Td>
                        <Td>{emptyText(row.manager_name)}</Td>
                        <Td>
                          <span style={phoneStyle(Boolean(row.manager_phone_is_duplicate))} title={row.manager_phone_is_duplicate ? `중복 연락처 ${row.manager_phone_duplicate_count}건` : ''}>
                            {formatPhone(row.manager_phone)}
                          </span>
                        </Td>
                        <Td title={emptyText(row.agency_company)}>{truncate(row.agency_company, 24)}</Td>
                        <Td title={emptyText(row.apartment_fee)}>{truncate(row.apartment_fee, 20)}</Td>
                        <Td>{emptyText(row.move_in_date)}</Td>
                        <Td>
                          {row.source_url ? (
                            <button type="button" onClick={() => openSourcePopup(row.source_url)} style={linkButtonStyle}>원본공고</button>
                          ) : '-'}
                        </Td>
                        <Td>
                          <select
                            value={row.assigned_to || ''}
                            onChange={(event) => updateAssignee(row.id, event.target.value)}
                            disabled={assignSavingId === row.id}
                            style={selectStyle}
                          >
                            <option value="">담당자 선택</option>
                            {ASSIGNEES.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </Td>
                        <Td>
                          <button type="button" onClick={() => setOpenedId(opened ? null : row.id)} style={detailButtonStyle}>
                            {opened ? '닫기' : '보기'}
                          </button>
                        </Td>
                      </tr>
                      {opened ? (
                        <tr>
                          <td colSpan={13} style={detailRowCellStyle}>
                            <div style={detailBoxStyle}>
                              <div style={detailTitleStyle}>상세정보</div>
                              <pre style={detailPreStyle}>{emptyText(row.detail_text)}</pre>
                              <div style={metaGridStyle}>
                                <Info label="제목" value={row.title} />
                                <Info label="요약" value={row.summary} />
                                <Info label="대표 현장명" value={row.resolved_site_name} />
                                <Info label="세대수/단지수" value={[row.unit_count, row.complex_count].filter(Boolean).join(' / ')} />
                                <Info label="사업지 주소" value={row.site_address} />
                                <Info label="근무지 주소" value={row.work_address} />
                                <Info label="카테고리" value={row.category} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={small ? summarySmallValueStyle : summaryValueStyle}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span style={infoLabelStyle}>{label}</span>
      <span>{emptyText(value)}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children, title }: { children: React.ReactNode; title?: string }) {
  return <td title={title} style={tdStyle}>{children}</td>;
}

const pageStyle: React.CSSProperties = {
  padding: '24px',
  color: 'var(--text)',
  background: 'var(--bg)',
  minHeight: '100vh',
};
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 'var(--fs-page-title)', lineHeight: 1.2, fontWeight: 900, color: 'var(--text-strong)' };
const subtitleStyle: React.CSSProperties = { margin: '8px 0 0', fontSize: 14, color: 'var(--text-muted)' };
const noticeStyle: React.CSSProperties = { display: 'inline-flex', marginTop: 14, padding: '8px 12px', border: '1px solid var(--accent-border)', borderRadius: 999, color: 'var(--accent-text)', fontSize: 13, fontWeight: 700, background: 'var(--accent-subtle)' };
const panelStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 16, padding: 18, background: 'var(--surface)', boxShadow: 'var(--shadow-xs)', marginBottom: 18 };
const regionWrapStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 };
const regionButtonStyle = (active: boolean): React.CSSProperties => ({ padding: '10px 15px', borderRadius: 999, border: active ? '1px solid var(--accent-border)' : '1px solid var(--border)', color: active ? '#fff' : 'var(--text-muted)', background: active ? 'var(--accent)' : 'var(--surface-2)', cursor: 'pointer', fontWeight: 800 });
const searchRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto auto', gap: 10, alignItems: 'center' };
const searchInputStyle: React.CSSProperties = { height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '0 14px', outline: 'none' };
const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({ height: 42, padding: '0 18px', border: 0, borderRadius: 10, color: '#fff', background: disabled ? 'var(--text-disabled)' : 'var(--accent)', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 900 });
const secondaryButtonStyle = (disabled: boolean): React.CSSProperties => ({ height: 42, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border)', color: disabled ? 'var(--text-disabled)' : 'var(--text)', background: 'var(--surface-2)', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 800 });
const excelButtonStyle = (disabled: boolean): React.CSSProperties => ({ height: 42, padding: '0 16px', borderRadius: 10, border: '1px solid var(--success-border)', color: disabled ? 'var(--text-disabled)' : 'var(--success-text)', background: disabled ? 'var(--surface-2)' : 'var(--success-bg)', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 900 });
const errorStyle: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-text)' };
const summaryGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 16 };
const summaryCardStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' };
const summaryLabelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-subtle)', marginBottom: 8, fontWeight: 800 };
const summaryValueStyle: React.CSSProperties = { fontSize: 26, fontWeight: 900, color: 'var(--text-strong)' };
const summarySmallValueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.6 };
const tablePanelStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' };
const tableScrollStyle: React.CSSProperties = { overflowX: 'auto' };
const tableStyle: React.CSSProperties = { width: '100%', minWidth: 1600, borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { padding: '14px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '14px 12px', textAlign: 'center', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', color: 'var(--text)', verticalAlign: 'middle', whiteSpace: 'nowrap' };
const emptyCellStyle: React.CSSProperties = { ...tdStyle, padding: 40, color: 'var(--text-subtle)' };
const openedRowStyle: React.CSSProperties = { background: 'var(--accent-subtle)' };
const detailRowCellStyle: React.CSSProperties = { padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' };
const sectionBadgeColorMap: Record<string, Pick<React.CSSProperties, 'background' | 'color' | 'border'>> = {
  유니크: { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' },
  슈페리어: { background: 'var(--purple-bg)', color: 'var(--purple-text)', border: '1px solid var(--purple-border)' },
  프리미엄: { background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' },
  전국TOP: { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' },
  일반구인글: { background: 'var(--accent-subtle)', color: 'var(--accent-text)', border: '1px solid var(--accent-border)' },
};
const sectionBadgeStyle = (section: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 72,
  padding: '6px 9px',
  borderRadius: 999,
  fontWeight: 900,
  ...(sectionBadgeColorMap[section] || sectionBadgeColorMap['일반구인글']),
});
const unitCountBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: 0,
  padding: '3px 7px',
  borderRadius: 999,
  background: 'var(--success-bg)',
  color: 'var(--success-text)',
  border: '1px solid var(--success-border)',
  fontSize: 11,
  fontWeight: 900,
  verticalAlign: 'middle',
};
const complexCountBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: 6,
  padding: '3px 7px',
  borderRadius: 999,
  background: 'var(--info-bg)',
  color: 'var(--info-text)',
  border: '1px solid var(--info-border)',
  fontSize: 11,
  fontWeight: 900,
  verticalAlign: 'middle',
};
const phoneStyle = (duplicate: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: duplicate ? '6px 10px' : 0, borderRadius: duplicate ? 999 : 0, color: duplicate ? 'var(--success-text)' : 'var(--text)', background: duplicate ? 'var(--success-bg)' : 'transparent', border: duplicate ? '1px solid var(--success-border)' : 'none', fontWeight: 900 });
const linkButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 8, color: 'var(--accent-text)', background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', textDecoration: 'none', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const selectStyle: React.CSSProperties = { minWidth: 118, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '0 8px', fontWeight: 800 };
const detailButtonStyle: React.CSSProperties = { height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontWeight: 900 };
const detailBoxStyle: React.CSSProperties = { margin: 14, padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', whiteSpace: 'normal' };
const detailTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 900, marginBottom: 10, color: 'var(--text-strong)' };
const detailPreStyle: React.CSSProperties = { maxHeight: 260, overflow: 'auto', margin: 0, padding: 14, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' };
const metaGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12, fontSize: 13, color: 'var(--text)' };
const infoLabelStyle: React.CSSProperties = { color: 'var(--text-muted)', marginRight: 8 };
