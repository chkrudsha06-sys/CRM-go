'use client';

import { useEffect, useMemo, useState } from 'react';
import type React from 'react';

type BunyanglineRow = {
  id: string;
  region_name: string | null;
  site_name: string | null;
  site_address: string | null;
  posted_at: string | null;
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

function formatDate(value: string | null) {
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
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) return '-';

  if (digits.length === 11 && digits.startsWith('010')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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

  return value?.trim() || '-';
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
        throw new Error(result?.message || result?.error || '조회 실패');
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
    <main style={{ padding: '28px', background: '#f6f8fb', minHeight: '100vh', color: '#111827' }}>
      <section style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '28px', lineHeight: '1.2', fontWeight: 800, margin: 0 }}>분양라인데이터</h1>
            <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
              분양라인 지역현장 구인공고를 지역별로 누적 수집하고 신규 현장을 확인합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRows}
            disabled={loading}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1px solid #d1d5db',
              background: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {REGIONS.map((region) => {
            const active = selectedRegion === region;
            return (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
                  background: active ? '#2563eb' : '#fff',
                  color: active ? '#fff' : '#374151',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
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
            style={{
              height: '42px',
              minWidth: '320px',
              flex: '1 1 360px',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '0 13px',
              fontSize: '14px',
              outline: 'none',
            }}
          />

          <button
            type="button"
            onClick={loadRows}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            검색
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#374151' }}>
            <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
            신규만 보기
          </label>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
          <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 700 }}>현재 출력건수</div>
          <div style={{ marginTop: '6px', fontSize: '26px', fontWeight: 900 }}>{rows.length.toLocaleString()}건</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
          <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 700 }}>신규 현장</div>
          <div style={{ marginTop: '6px', fontSize: '26px', fontWeight: 900 }}>{newCount.toLocaleString()}건</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
          <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: 700 }}>선택 지역</div>
          <div style={{ marginTop: '6px', fontSize: '26px', fontWeight: 900 }}>{selectedRegion}</div>
        </div>
      </section>

      {errorMessage ? (
        <div style={{ marginBottom: '14px', padding: '14px 16px', borderRadius: '12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 700 }}>
          {errorMessage}
        </div>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1120px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['지역', '현장명', '등록일', '담당자이름', '담당자연락처', '대행사', '수수료', '신규여부', '상세정보'].map((header) => (
                  <th key={header} style={{ padding: '13px 12px', textAlign: 'center', fontSize: '13px', color: '#374151', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '42px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>
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

function FragmentRow({ row, opened, onToggle }: { row: BunyanglineRow; opened: boolean; onToggle: () => void }) {
  return (
    <>
      <tr style={{ borderBottom: opened ? '0' : '1px solid #f3f4f6' }}>
        <td style={tdCenter}>{emptyText(row.region_name)}</td>
        <td style={{ ...tdCenter, maxWidth: '280px', fontWeight: 800, whiteSpace: 'normal', wordBreak: 'keep-all', lineHeight: 1.45 }}>{emptyText(row.site_name)}</td>
        <td style={tdCenter}>{formatDate(row.posted_at)}</td>
        <td style={tdCenter}>{emptyText(row.manager_name)}</td>
        <td style={tdCenter}>{formatPhone(row.manager_phone)}</td>
        <td style={tdCenter}>{emptyText(row.agency_company)}</td>
        <td style={{ ...tdCenter, maxWidth: '170px' }}>{emptyText(row.apartment_fee)}</td>
        <td style={tdCenter}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '54px',
              height: '28px',
              borderRadius: '999px',
              background: row.is_new ? '#dcfce7' : '#f3f4f6',
              color: row.is_new ? '#166534' : '#6b7280',
              fontSize: '13px',
              fontWeight: 900,
            }}
          >
            {row.is_new ? '신규' : 'X'}
          </span>
        </td>
        <td style={tdCenter}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {opened ? '접기' : '보기'}
          </button>
        </td>
      </tr>

      {opened ? (
        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
          <td colSpan={9} style={{ padding: '0 16px 18px' }}>
            <div style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '12px', padding: '16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '15px' }}>상세정보</strong>
                {row.source_url ? (
                  <a href={row.source_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '13px', fontWeight: 800 }}>
                    원본공고 열기
                  </a>
                ) : null}
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.7, color: '#374151' }}>
                {emptyText(row.detail_text)}
              </pre>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

const tdCenter: React.CSSProperties = {
  padding: '13px 12px',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '14px',
  color: '#111827',
  whiteSpace: 'nowrap',
};
