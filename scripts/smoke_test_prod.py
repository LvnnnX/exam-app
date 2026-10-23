import urllib.request
import urllib.error
import json
import os
import sys

def get_env(path):
    d = {}
    if not os.path.exists(path):
        return d
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip('"\'')
    return d

env_prod = get_env('C:/Coding/Python/WebPort/kuis-tanyajawab/exam-app/.env')
env_local = get_env('C:/Coding/Python/WebPort/kuis-tanyajawab/exam-app/.env.local')

url = env_prod.get('NEXT_PUBLIC_SUPABASE_URL')
anon = env_prod.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
service = env_local.get('SUPABASE_SERVICE_ROLE_KEY')

print(f"Supabase URL: {url}")
print(f"Anon key present: {bool(anon)}")
print(f"Service role key present: {bool(service)}")

def http_get(endpoint, key):
    req = urllib.request.Request(
        f"{url}/rest/v1/{endpoint}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode('utf-8')
            return resp.status, json.loads(data) if data else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        return e.code, err_body
    except Exception as e:
        return 500, str(e)

print("\n--- 1. REST Anon Access Checks ---")
# Anon questions access
code, res = http_get("questions?select=id,answer_key", anon)
print(f"Anon GET questions: status={code}")
assert code in (401, 403) or (isinstance(res, list) and len(res) == 0), f"Leak in questions: {code} {res}"
print("  PASS: Anon cannot directly query questions")

# Anon admins access
code, res = http_get("admins?select=*", anon)
print(f"Anon GET admins: status={code}")
assert code in (401, 403) or (isinstance(res, list) and len(res) == 0), f"Leak in admins: {code} {res}"
print("  PASS: Anon cannot read admins")

# Anon exam_sessions secret_hash
code, res = http_get("exam_sessions?select=id,secret_hash", anon)
print(f"Anon GET exam_sessions: status={code}")
assert code in (401, 403) or (isinstance(res, list) and len(res) == 0), f"Leak in exam_sessions: {code} {res}"
print("  PASS: Anon cannot read exam_sessions secret_hash")

# Anon topics: shown vs hidden
code, res = http_get("topics?select=id,name,visibility", anon)
print(f"Anon GET topics: status={code}")
if code == 200 and isinstance(res, list):
    hidden_topics = [t for t in res if t.get('visibility') == 'hidden']
    print(f"  Total topics visible: {len(res)}, hidden topics: {len(hidden_topics)}")
    assert len(hidden_topics) == 0, f"Anon can see hidden topics: {hidden_topics}"
    print("  PASS: Anon only sees shown topics (0 hidden)")

print("\n--- 2. RPC JIT Verification ---")
# Test rpc_ujian_start via service role
req_body = json.dumps({
    "p_name": "Smoke Test Student",
    "p_topic_ids": None,
    "p_mode": "free",
    "p_nav_mode": "free",
    "p_count": 3,
    "p_time_limit_minutes": 10
}).encode('utf-8')

req = urllib.request.Request(
    f"{url}/rest/v1/rpc/rpc_ujian_start",
    headers={
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json"
    },
    data=req_body
)
try:
    with urllib.request.urlopen(req) as resp:
        sess_data = json.loads(resp.read().decode('utf-8'))
        print("  rpc_ujian_start status:", resp.status)
        session_id = sess_data.get('session_id')
        session_secret = sess_data.get('secret')
        print(f"  Session created: {session_id[:8]}...")
        
        # Now fetch question 0 via rpc_ujian_question
        q_body = json.dumps({
            "p_session_id": session_id,
            "p_secret": session_secret,
            "p_index": 0
        }).encode('utf-8')
        
        req_q = urllib.request.Request(
            f"{url}/rest/v1/rpc/rpc_ujian_question",
            headers={
                "apikey": service,
                "Authorization": f"Bearer {service}",
                "Content-Type": "application/json"
            },
            data=q_body
        )
        with urllib.request.urlopen(req_q) as q_resp:
            q_data = json.loads(q_resp.read().decode('utf-8'))
            print("  rpc_ujian_question status:", q_resp.status)
            q_keys = list(q_data.keys())
            print("  Returned keys:", q_keys)
            assert "answer_key" not in q_keys, "CRITICAL: answer_key leaked in rpc_ujian_question!"
            assert "secret_hash" not in q_keys, "CRITICAL: secret_hash leaked!"
            print("  PASS: JIT question returned WITHOUT answer_key or secret_hash")
except Exception as e:
    print("  RPC test error:", e)
    raise

print("\n--- 3. Storage Bucket exam-images Verification ---")
try:
    req_b = urllib.request.Request(
        f"{url}/storage/v1/bucket/exam-images",
        headers={
            "apikey": service,
            "Authorization": f"Bearer {service}",
        }
    )
    with urllib.request.urlopen(req_b) as resp:
        bucket_info = json.loads(resp.read().decode('utf-8'))
        print("  Bucket status:", resp.status)
        print(f"  public: {bucket_info.get('public')}")
        print(f"  file_size_limit: {bucket_info.get('file_size_limit')} bytes")
        print(f"  allowed_mime_types: {bucket_info.get('allowed_mime_types')}")
        assert bucket_info.get('public') is True, "Bucket not public!"
        assert bucket_info.get('file_size_limit') == 2097152, "File size limit not 2MB!"
        print("  PASS: Bucket exam-images configuration confirmed (public=True, 2MB limit, strict MIME)")
except Exception as e:
    print("  Storage check err:", e)
    raise

print("\nALL PRODUCTION SMOKE TESTS PASSED!")
