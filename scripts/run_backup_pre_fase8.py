import os
import sys
import subprocess
import hashlib

out_dir = 'E:/Backups/exam-app/prod-pre-fase8'
os.makedirs(f'{out_dir}/csv', exist_ok=True)
os.makedirs(f'{out_dir}/logs', exist_ok=True)

db_url = None
with open('C:/Coding/Python/WebPort/kuis-tanyajawab/exam-app-v2/.env.local', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            db_url = line.strip().split('=', 1)[1].strip('"\'')
            break

if not db_url:
    print('DATABASE_URL not found')
    sys.exit(1)

bin_dir = 'C:/Users/Windows/tools/pgsql17/bin'
pg_dump = f'{bin_dir}/pg_dump.exe'
psql = f'{bin_dir}/psql.exe'

env = os.environ.copy()
env['PGOPTIONS'] = '-c default_transaction_read_only=on'
env['PGCONNECT_TIMEOUT'] = '30'

dumps = [
    ('1. schema-only', [pg_dump, '-d', db_url, '--schema-only', '-n', 'public', '-n', 'private', '-Fp', '--no-owner', '--no-privileges', '-f', f'{out_dir}/prod-schema.sql'], f'{out_dir}/logs/dump_schema.err'),
    ('2. data-only', [pg_dump, '-d', db_url, '--data-only', '-n', 'public', '-n', 'private', '-Fp', '--no-owner', '--no-privileges', '-f', f'{out_dir}/prod-data.sql'], f'{out_dir}/logs/dump_data.err'),
    ('3. full custom', [pg_dump, '-d', db_url, '-n', 'public', '-n', 'private', '-Fc', '-Z', '6', '-f', f'{out_dir}/prod-public-private.full.dump'], f'{out_dir}/logs/dump_custom.err'),
    ('4. full plain', [pg_dump, '-d', db_url, '-n', 'public', '-n', 'private', '-Fp', '-f', f'{out_dir}/prod-public-private.full.sql'], f'{out_dir}/logs/dump_plain_full.err'),
    ('5. portable noowner', [pg_dump, '-d', db_url, '-n', 'public', '-n', 'private', '-Fp', '--no-owner', '--no-privileges', '-f', f'{out_dir}/prod-public-private.noowner.sql'], f'{out_dir}/logs/dump_plain_portable.err'),
    ('6. cron job', [pg_dump, '-d', db_url, '--data-only', '-t', 'cron.job', '-Fp', '--no-owner', '--no-privileges', '-f', f'{out_dir}/prod-cron-job.data.sql'], f'{out_dir}/logs/dump_cron.err'),
    ('7. storage metadata', [pg_dump, '-d', db_url, '--data-only', '-t', 'storage.buckets', '-t', 'storage.objects', '-Fp', '--no-owner', '--no-privileges', '-f', f'{out_dir}/prod-storage-metadata.data.sql'], f'{out_dir}/logs/dump_storage.err'),
    ('8. auth data', [pg_dump, '-d', db_url, '--data-only', '-n', 'auth', '-Fc', '-f', f'{out_dir}/prod-auth.data.dump'], f'{out_dir}/logs/dump_auth.err')
]

for label, cmd, errfile in dumps:
    print(f'Running {label}...')
    with open(errfile, 'w') as errf:
        res = subprocess.run(cmd, env=env, stderr=errf)
    if res.returncode != 0:
        print(f'ERROR in {label}, code: {res.returncode}')
        with open(errfile, 'r') as errf:
            print(errf.read())
        sys.exit(1)

# Export tables to CSV
print('Exporting table list for CSV...')
tables_cmd = [psql, '-d', db_url, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', 
    "SELECT n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','m') ORDER BY 1"]
res = subprocess.run(tables_cmd, env=env, capture_output=True, text=True)
if res.returncode != 0:
    print('Failed to get tables:', res.stderr)
    sys.exit(1)

tables = [t.strip() for t in res.stdout.strip().splitlines() if t.strip()]
print(f'Found {len(tables)} tables to export to CSV.')

with open(f'{out_dir}/logs/csv.err', 'w') as errf:
    for t in tables:
        csv_file = f'{out_dir}/csv/{t}.csv'
        copy_cmd = [psql, '-d', db_url, '-X', '-v', 'ON_ERROR_STOP=1', '-c', f'COPY (SELECT * FROM {t}) TO STDOUT WITH (FORMAT csv, HEADER)']
        with open(csv_file, 'wb') as cf:
            cres = subprocess.run(copy_cmd, env=env, stdout=cf, stderr=errf)
        if cres.returncode != 0:
            print(f'Failed CSV for {t}')

# SHA256 checksums
print('Calculating SHA256 checksums...')
checksums = []
for root, dirs, files in os.walk(out_dir):
    for f in sorted(files):
        if f == 'SHA256SUMS.txt':
            continue
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, out_dir).replace('\\', '/')
        h = hashlib.sha256()
        with open(full_path, 'rb') as fp:
            while chunk := fp.read(65536):
                h.update(chunk)
        checksums.append(f'{h.hexdigest()}  {rel_path}')

with open(f'{out_dir}/SHA256SUMS.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(checksums) + '\n')

print(f'Done. {len(checksums)} files hashed in {out_dir}/SHA256SUMS.txt')
