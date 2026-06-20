'use client';

import { useEffect, useMemo, useState } from 'react';
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

type BunyanglineRow = {
  id: number | string;
  region_name: string | null;
  ad_section: string | null;
  site_name: string | null;
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
    return rows.reduce<Record<string, number>>((acc, row) => {
      const key = emptyText(row.ad_section);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  async function fetchRows(nextRegion = selectedRegion, nextKeyword = keyword) {
    setLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams({
        region: nextRegion,
        keyword: nextKeyword,
        limit: '2000',
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
            <p style={subtitleStyle}>분양라인 지역현장 구인공고를 최근 5일 기준으로 수집하고, 담당자 연락처 중복 여부를 확인합니다.</p>
            <div style={noticeStyle}>수집 기준: 지역별 전체 지면 · 최근 5일 등록 공고 · 원본공고 링크 기준 누적 저장</div>
          </div>
          <button type="button" onClick={() => fetchRows()} disabled={loading} style={secondaryButtonStyle(loading)}>
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
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
        <SummaryCard label="게재지면" value={Object.entries(sectionCounts).map(([name, count]) => `${name} ${count}`).join(' · ') || '-'} small />
      </section>

      <section style={tablePanelStyle}>
        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>지역</Th>
                <Th>게재지면</Th>
                <Th>현장명</Th>
                <Th>등록일</Th>
                <Th>담당자이름</Th>
                <Th>담당자 연락처</Th>
                <Th>대행사</Th>
                <Th>수수료</Th>
                <Th>투입일</Th>
                <Th>원본공고링크</Th>
                <Th>담당자</Th>
                <Th>상세정보</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={emptyCellStyle}>데이터를 불러오는 중입니다.</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={emptyCellStyle}>표시할 데이터가 없습니다.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const opened = openedId === row.id;
                  return (
                    <tr key={row.id} style={opened ? openedRowStyle : undefined}>
                      <Td>{emptyText(row.region_name)}</Td>
                      <Td><span style={sectionBadgeStyle}>{emptyText(row.ad_section)}</span></Td>
                      <Td title={emptyText(row.site_name)}><strong>{truncate(row.site_name, 24)}</strong></Td>
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
                          <a href={row.source_url} target="_blank" rel="noreferrer" style={linkButtonStyle}>원본공고</a>
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
                        {opened ? (
                          <div style={detailBoxStyle}>
                            <div style={detailTitleStyle}>상세정보</div>
                            <pre style={detailPreStyle}>{emptyText(row.detail_text)}</pre>
                            <div style={metaGridStyle}>
                              <Info label="제목" value={row.title} />
                              <Info label="요약" value={row.summary} />
                              <Info label="사업지 주소" value={row.site_address} />
                              <Info label="근무지 주소" value={row.work_address} />
                              <Info label="카테고리" value={row.category} />
                            </div>
                          </div>
                        ) : null}
                      </Td>
                    </tr>
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
      <span style={{ color: '#8aa0b9', marginRight: 8 }}>{label}</span>
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

const pageStyle: React.CSSProperties = { padding: '24px', color: '#f8fafc', background: '#0f0f10', minHeight: '100vh' };
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 28, lineHeight: 1.2, fontWeight: 900 };
const subtitleStyle: React.CSSProperties = { margin: '8px 0 0', fontSize: 14, color: '#aab6c5' };
const noticeStyle: React.CSSProperties = { display: 'inline-flex', marginTop: 14, padding: '8px 12px', border: '1px solid rgba(139, 92, 246, 0.55)', borderRadius: 999, color: '#d8ccff', fontSize: 13, fontWeight: 700, background: 'rgba(139, 92, 246, 0.12)' };
const panelStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 18, background: '#151515', marginBottom: 18 };
const regionWrapStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 };
const regionButtonStyle = (active: boolean): React.CSSProperties => ({ padding: '10px 15px', borderRadius: 999, border: active ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)', color: active ? '#fff' : '#cbd5e1', background: active ? '#8b5cf6' : '#171717', cursor: 'pointer', fontWeight: 800 });
const searchRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto auto', gap: 10, alignItems: 'center' };
const searchInputStyle: React.CSSProperties = { height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: '#101010', color: '#fff', padding: '0 14px', outline: 'none' };
const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({ height: 42, padding: '0 18px', border: 0, borderRadius: 10, color: '#fff', background: disabled ? '#4b5563' : '#8b5cf6', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 900 });
const secondaryButtonStyle = (disabled: boolean): React.CSSProperties => ({ height: 42, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', color: disabled ? '#667085' : '#fff', background: '#171717', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 800 });
const errorStyle: React.CSSProperties = { marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.25)', color: '#fecaca' };
const summaryGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 16 };
const summaryCardStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, background: '#151515' };
const summaryLabelStyle: React.CSSProperties = { fontSize: 13, color: '#93a4b7', marginBottom: 8, fontWeight: 800 };
const summaryValueStyle: React.CSSProperties = { fontSize: 26, fontWeight: 900, color: '#fff' };
const summarySmallValueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#e5e7eb', lineHeight: 1.6 };
const tablePanelStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', background: '#151515' };
const tableScrollStyle: React.CSSProperties = { overflowX: 'auto' };
const tableStyle: React.CSSProperties = { width: '100%', minWidth: 1500, borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { padding: '14px 12px', textAlign: 'center', fontSize: 12, color: '#9db1c9', background: '#1b1b1d', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '14px 12px', textAlign: 'center', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#f8fafc', verticalAlign: 'middle', whiteSpace: 'nowrap' };
const emptyCellStyle: React.CSSProperties = { ...tdStyle, padding: 40, color: '#94a3b8' };
const openedRowStyle: React.CSSProperties = { background: 'rgba(139, 92, 246, 0.05)' };
const sectionBadgeStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 72, padding: '6px 9px', borderRadius: 999, background: 'rgba(59,130,246,0.14)', color: '#bfdbfe', border: '1px solid rgba(59,130,246,0.25)', fontWeight: 900 };
const phoneStyle = (duplicate: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: duplicate ? '6px 10px' : 0, borderRadius: duplicate ? 999 : 0, color: duplicate ? '#dcfce7' : '#f8fafc', background: duplicate ? '#14532d' : 'transparent', border: duplicate ? '1px solid rgba(34,197,94,0.5)' : 'none', fontWeight: 900 });
const linkButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 8, color: '#ddd6fe', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', textDecoration: 'none', fontWeight: 900 };
const selectStyle: React.CSSProperties = { minWidth: 118, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#101010', color: '#fff', padding: '0 8px', fontWeight: 800 };
const detailButtonStyle: React.CSSProperties = { height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: '#171717', color: '#fff', cursor: 'pointer', fontWeight: 900 };
const detailBoxStyle: React.CSSProperties = { position: 'absolute', right: 28, left: 28, marginTop: 12, zIndex: 10, padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: '#101010', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'left', whiteSpace: 'normal' };
const detailTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 900, marginBottom: 10, color: '#fff' };
const detailPreStyle: React.CSSProperties = { maxHeight: 260, overflow: 'auto', margin: 0, padding: 14, borderRadius: 10, background: '#171717', color: '#e5e7eb', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' };
const metaGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12, fontSize: 13, color: '#e5e7eb' };
