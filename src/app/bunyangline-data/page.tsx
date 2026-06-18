'use client';

import { useEffect, useMemo, useState } from 'react';
import type React from 'react';

type BunyanglineRow = {
  id: string;
  region_name: string | null;
  site_name: string | null;
  site_address: string | null;
  posted_at: string | null;
  posted_datetime?: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  agency_company: string | null;
  apartment_fee: string | null;
  is_new: boolean;
  detail_text: string | null;
  source_url: string | null;
  crawled_at: string | null;
  created_at: string | null;
};

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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value;
  const [y, m, d] = date.split('-');
  return `${y}.${m}.${d}`;
}

function emptyText(value: string | null | undefined) {
  return value?.trim() || '-';
}

function formatPhone(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '-';

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 11 && /^01[016789]/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10 && /^01[016789]/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 10 && digits.startsWith('02')) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 9 && digits.startsWith('02')) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return raw || '-';
}

export default function BunyanglineDataPage() {
  const [selectedRegion, setSelectedRegion] = useState('모든지역');
  const [keyword, setKeyword] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [rows, setRows] = useState<BunyanglineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [openedId, setOpenedId] = useState<string | null>(null);

  const newCount = useMemo(() => rows.filter((row) => row.is_new).length, [rows]);

  async function loadRows() {
    setLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams({
        region: selectedRegion,
        keyword,
        onlyNew: String(onlyNew),
        limit: '300',
      });

      const response = await fetch(`/api/bunyangline-data/list?${params.toString()}`, {
        cache: 'no-store',
      });

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

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion, onlyNew]);

  return (
    <main style={pageStyle}>
      <section style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '28px', lineHeight: '1.2', fontWeight: 800, margin: 0, color: 'var(--text-strong)' }}>분양라인데이터</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-subtle)', fontSize: '14px' }}>
              분양라인 지역현장 구인공고를 지역별로 누적 수집하고 신규 현장을 확인합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            style={secondaryButtonStyle(loading)}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {REGIONS.map((region) => {
            const active = selectedRegion === region;
            return (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                style={regionButtonStyle(active)}
              >
                {region}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadRows();
            }}
            placeholder="현장명 / 담당자 / 연락처 / 대행사 검색"
            style={inputStyle}
          />

          <button type="button" onClick={loadRows} style={primaryButtonStyle}>
            검색
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-subtle)' }}>
            <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
            신규만 보기
          </label>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="현재 출력건수" value={`${rows.length.toLocaleString()}건`} />
        <StatCard label="신규 현장" value={`${newCount.toLocaleString()}건`} />
        <StatCard label="선택 지역" value={selectedRegion} />
      </section>

      {errorMessage ? (
        <div style={errorBoxStyle}>{errorMessage}</div>
      ) : null}

      <section style={tablePanelStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1120px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['지역', '현장명', '등록일', '담당자이름', '담당자연락처', '대행사', '수수료', '신규여부', '상세정보'].map((header) => (
                  <th key={header} style={thStyle}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '42px 12px', textAlign: 'center', color: 'var(--text-subtle)', fontWeight: 700 }}>
                    {loading ? '데이터를 불러오는 중입니다.' : '등록된 분양라인데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const opened = openedId === row.id;
                  return (
                    <FragmentRow
                      key={row.id}
                      row={row}
                      opened={opened}
                      onToggle={() => setOpenedId(opened ? null : row.id)}
                    />
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ color: 'var(--text-subtle)', fontSize: '13px', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: '6px', fontSize: '26px', fontWeight: 900, color: 'var(--text-strong)' }}>{value}</div>
    </div>
  );
}

function FragmentRow({ row, opened, onToggle }: { row: BunyanglineRow; opened: boolean; onToggle: () => void }) {
  return (
    <>
      <tr style={{ borderBottom: opened ? '0' : '1px solid var(--border-subtle)' }}>
        <td style={tdCenter}>{emptyText(row.region_name)}</td>
        <td style={{ ...tdCenter, maxWidth: '280px', fontWeight: 800, whiteSpace: 'normal', wordBreak: 'keep-all', lineHeight: 1.45 }}>{emptyText(row.site_name)}</td>
        <td style={tdCenter}>{formatDate(row.posted_datetime || row.posted_at)}</td>
        <td style={tdCenter}>{emptyText(row.manager_name)}</td>
        <td style={tdCenter}>{formatPhone(row.manager_phone)}</td>
        <td style={tdCenter}>{emptyText(row.agency_company)}</td>
        <td style={{ ...tdCenter, maxWidth: '170px' }}>{emptyText(row.apartment_fee)}</td>
        <td style={tdCenter}>
          <span style={newBadgeStyle(row.is_new)}>
            {row.is_new ? '신규' : 'X'}
          </span>
        </td>
        <td style={tdCenter}>
          <button type="button" onClick={onToggle} style={smallButtonStyle}>
            {opened ? '접기' : '보기'}
          </button>
        </td>
      </tr>

      {opened ? (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <td colSpan={9} style={{ padding: '0 16px 18px' }}>
            <div style={detailBoxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '15px', color: 'var(--text-strong)' }}>상세정보</strong>
                {row.source_url ? (
                  <a href={row.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)', fontSize: '13px', fontWeight: 800 }}>
                    원본공고 열기
                  </a>
                ) : null}
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-subtle)' }}>
                {emptyText(row.detail_text)}
              </pre>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '28px',
  background: 'var(--bg)',
  minHeight: '100vh',
  color: 'var(--text)',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '16px',
  boxShadow: 'var(--shadow-sm)',
};

const tablePanelStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
};

const statCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '14px',
  padding: '16px',
};

const inputStyle: React.CSSProperties = {
  height: '42px',
  minWidth: '320px',
  flex: '1 1 360px',
  border: '1px solid var(--border-2)',
  borderRadius: '10px',
  padding: '0 13px',
  fontSize: '14px',
  outline: 'none',
  background: 'var(--surface)',
  color: 'var(--text)',
};

const primaryButtonStyle: React.CSSProperties = {
  height: '42px',
  padding: '0 16px',
  borderRadius: '10px',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    height: '40px',
    padding: '0 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-2)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function regionButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: '38px',
    padding: '0 14px',
    borderRadius: '999px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border-2)',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-subtle)',
    fontWeight: active ? 800 : 600,
    cursor: 'pointer',
  };
}

const errorBoxStyle: React.CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '12px',
  background: 'var(--danger-bg)',
  color: 'var(--danger-text)',
  border: '1px solid var(--danger-border)',
  fontWeight: 700,
};

const thStyle: React.CSSProperties = {
  padding: '13px 12px',
  textAlign: 'center',
  fontSize: '13px',
  color: 'var(--text-subtle)',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const tdCenter: React.CSSProperties = {
  padding: '13px 12px',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '14px',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
};

function newBadgeStyle(isNew: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '54px',
    height: '28px',
    borderRadius: '999px',
    background: isNew ? 'var(--success-bg)' : 'var(--surface-2)',
    color: isNew ? 'var(--success-text)' : 'var(--text-faint)',
    border: `1px solid ${isNew ? 'var(--success-border)' : 'var(--border-subtle)'}`,
    fontSize: '13px',
    fontWeight: 900,
  };
}

const smallButtonStyle: React.CSSProperties = {
  height: '32px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-2)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontWeight: 800,
  cursor: 'pointer',
};

const detailBoxStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-2)',
  borderRadius: '12px',
  padding: '16px',
  marginTop: '4px',
};
