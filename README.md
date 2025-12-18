# Absensi Sinergi (Next.js + Supabase)

Stack: Next.js (App Router, TS), Tailwind CSS, Supabase, deploy on Vercel.

## Fitur Utama
- Scan kehadiran (public) pakai kamera, QR berisi `eventId:participantCode`.
- Pencatatan kehadiran multi-scan (boleh berkali-kali).
- Tampilkan posisi duduk (meja & kursi) setelah scan berhasil.
- Login admin (email/password) untuk kelola event, peserta, seat, dan export.

## Struktur Penting
- `src/app/scan/page.tsx`: Halaman scan kamera + input manual.
- `src/app/api/attendance/scan/route.ts`: Endpoint API untuk insert ke `attendance_logs` dan mengembalikan informasi seat.
- `src/app/admin/login/page.tsx`: Halaman login admin.
- `src/app/admin/page.tsx`: Dashboard dasar admin.
- `src/lib/supabase/client.ts`: Supabase browser client.
- `src/lib/supabase/server.ts`: Supabase service admin client (gunakan Service Role di server only).
- `supabase/schema.sql`: Schema database (tables, indexes, basic RLS policies).

## Environment Variables
Buat file `.env.local` dari contoh `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=<<your-supabase-url>>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<<your-supabase-anon-key>>
SUPABASE_SERVICE_ROLE_KEY=<<your-service-role-key>>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- Anon key dipakai di browser.
- Service Role hanya dipakai di server (API Routes), jangan diekspos publik.

## Setup Supabase
1. Buat project Supabase.
2. Buka SQL Editor → jalankan `supabase/schema.sql`.
3. Aktifkan Email/Password Auth (Authentication → Providers → Email)
4. Buat user admin via Supabase Auth; opsional isi tabel `admins` untuk role.

## QR Format yang Disarankan
- Isi QR: `eventId:participantCode`.
- Di halaman scan, jika QR tidak mengandung `:`, sistem akan gunakan Event ID yang diinput manual.

## Menjalankan Project (Local)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Jalankan dev server:
   ```bash
   npm run dev
   ```
3. Buka `http://localhost:3000`

## Deploy ke Vercel
1. Push repo ke GitHub/GitLab/Bitbucket.
2. Import ke Vercel → set Environment Variables seperti `.env.local`.
3. Deploy. Pastikan SUPABASE_SERVICE_ROLE_KEY diset pada Environment Vercel (server only).

## Roadmap Lanjutan
- Halaman CRUD Event, Participants, Seats, Assignments, Import/Export.
- Middleware proteksi route admin berbasis session.
- Generator QR per peserta.
- Rate-limit throttling scan agar tidak spam (opsional di API).
