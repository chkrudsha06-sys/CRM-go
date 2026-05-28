import json
import os
import urllib.request
import urllib.error

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json; charset=utf-8",
    "Prefer": "return=minimal"
}

with open("data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"총 {len(data)}건 임포트 시작...")

BATCH = 200
success = 0

for i in range(0, len(data), BATCH):
    batch = data[i:i+BATCH]
    body = json.dumps(batch, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/contacts",
        data=body,
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as res:
            success += len(batch)
            print(f"  ✅ {min(i+BATCH, len(data))}/{len(data)} 완료")
    except urllib.error.HTTPError as e:
        print(f"  ❌ 오류: {e.read().decode('utf-8')[:200]}")

print(f"\n✅ 완료: {success}건 성공")
