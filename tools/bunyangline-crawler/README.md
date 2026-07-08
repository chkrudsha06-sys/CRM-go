# 분양라인 데이터 수집기

분양라인 지역현장의 유니크, 슈페리어, 프리미엄, 전국TOP, 일반구인글을 수집해 CRM의 `/api/bunyangline-data/import`로 전송합니다.

## 수집 기준

- CRM에 보관하는 날짜 하한: `2026-07-01`
- 날짜 판정값: 공고 상세 오른쪽 상단에 표시되는 날짜 (`.createdAt`)
- 중복 기준: 원본 공고 URL
- 아파트 분양 행이 없으면 공란 저장
- 상세정보가 사이트에서 비어 있으면 공란 저장

## GitHub Actions 실행

1. 배포 후 Actions의 **Bunyangline Data Crawler**를 수동 실행합니다.
2. 첫 실행은 `backfill`을 선택해 2026-07-01부터 전체 적재합니다.
3. 이후 예약 실행은 자동으로 `incremental` 모드가 적용되어 최근 3일을 다시 확인하고 누적 갱신합니다.

필수 GitHub Secrets:

- `CRM_BUNYANGLINE_IMPORT_URL`: 배포된 CRM의 `https://.../api/bunyangline-data/import`
- `BUNYANGLINE_IMPORT_SECRET`: CRM/Vercel의 같은 이름 환경변수와 동일한 값

## 로컬 검증

```powershell
$env:BUNYANGLINE_REGION_IDS='0'
$env:BUNYANGLINE_START_DATE='2026-07-01'
$env:BUNYANGLINE_CRAWL_MODE='backfill'
$env:BUNYANGLINE_MAX_PAGES='1'
$env:BUNYANGLINE_MAX_DETAILS='10'
$env:SEND_TO_CRM='false'
npm.cmd start
```

결과와 실패 목록은 `debug-output`에 JSON으로 저장됩니다.
