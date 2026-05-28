"""
분양회 CRM 데이터 임포트 스크립트
사용법: python import_data.py

필요 패키지: pip install supabase python-dotenv
"""

import json
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('../.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # service_role key 사용

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정하세요")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"총 {len(data)}건 임포트 시작...")

# 배치로 나눠서 삽입 (Supabase 1000건 제한)
BATCH_SIZE = 500
success = 0
errors = 0

for i in range(0, len(data), BATCH_SIZE):
    batch = data[i:i + BATCH_SIZE]
    try:
        result = supabase.table('contacts').insert(batch).execute()
        success += len(batch)
        print(f"  ✅ {i + len(batch)}/{len(data)} 완료")
    except Exception as e:
        errors += len(batch)
        print(f"  ❌ 배치 오류 ({i}~{i+len(batch)}): {e}")

print(f"\n✅ 임포트 완료: 성공 {success}건, 실패 {errors}건")
