# Laporan Audit Bundle JS First-Load (Fase 7)

Pengukuran first-load script dari origin sendiri (Playwright CDP `Network.setCacheDisabled`) pada build produksi Next.js.

| Route | Transfer (KB gzip) | Decoded (KB) | Script Files | Status (> 300 KB) | 3 Chunk Terbesar |
|---|---|---|---|---|---|
| / | 566.3 | 1799.5 | 13 | **FAIL (> 300 KB)** | `0ky_r0gwln9-z.js` (374.2 KB)<br>`0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB) |
| /ujian | 566.3 | 1799.5 | 13 | **FAIL (> 300 KB)** | `0ky_r0gwln9-z.js` (374.2 KB)<br>`0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB) |
| /kuis/117084 | 188.8 | 594.7 | 11 | PASS | `0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB)<br>`3tp1svoiibp50.js` (23.3 KB) |
| /admin/login | 140.9 | 458 | 9 | PASS | `0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB)<br>`0ay527mnq1105.js` (9.8 KB) |
| /admin | 780.6 | 2578.9 | 12 | **FAIL (> 300 KB)** | `0ky_r0gwln9-z.js` (374.2 KB)<br>`2b6imr01g4e2h.js` (257.6 KB)<br>`0bma92pht_c97.js` (70.4 KB) |
| /admin/soal | 780.6 | 2578.9 | 12 | **FAIL (> 300 KB)** | `0ky_r0gwln9-z.js` (374.2 KB)<br>`2b6imr01g4e2h.js` (257.6 KB)<br>`0bma92pht_c97.js` (70.4 KB) |
| /admin/kategori | 143.1 | 467.2 | 9 | PASS | `0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB)<br>`0ay527mnq1105.js` (9.8 KB) |
| /admin/kuis | 190.1 | 600.7 | 12 | PASS | `0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB)<br>`3tp1svoiibp50.js` (23.3 KB) |
| /admin/hasil | 526.6 | 1684.9 | 11 | **FAIL (> 300 KB)** | `0ky_r0gwln9-z.js` (374.2 KB)<br>`0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB) |
| /admin/kelola-admin | 143.3 | 467.5 | 9 | PASS | `0bma92pht_c97.js` (70.4 KB)<br>`2uawqbcxdpnki.js` (35.3 KB)<br>`0ay527mnq1105.js` (9.8 KB) |

## Catatan
- Ambang batas target: transfer gzip <= 300 KB per route.
- Semua chunk diukur saat fresh load dengan browser cache dinonaktifkan.
