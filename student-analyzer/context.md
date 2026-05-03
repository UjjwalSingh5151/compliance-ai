# Web Portal (student-analyzer) — CLAUDE.md

## Stack
Vite 6 + React 18, JavaScript (not TypeScript), hosted on Vercel.

## Entry point
`src/main.jsx` → `src/App.jsx` (handles auth state + school status routing)

## Key components
```
src/components/
  Dashboard.jsx         — main school admin view, tab-based
  AdminPanel.jsx        — super-admin: school approval, invite school, credits
  Analytics.jsx         — per-school analytics, teacher drill-down; AllStudentsTable with expandable per-test breakdown; error banner with retry on API failure
  BulkUpload.jsx        — upload + analyze answer sheets with SSE streaming; handles `fatal` event, shows stream error banner on network failure
  ResultDetail.jsx      — full result view: score, Q-by-Q, comments, share; clickable "⚠ Unassigned" badge + AssignModal for manual student assignment
  StudentCRM.jsx        — manage students (add, import CSV, view results)
  TeacherCRM.jsx        — manage teachers (add, import CSV, invite to app)
  PaperGenerator.jsx    — generate/transcribe question papers
```

## Auth flow
- Supabase email + password (school admins only)
- No OTP on web portal
- School registration → pending → admin approves → full access
- `App.jsx` detects: no session → Login | session + no school → SchoolSetup | school pending → PendingScreen | school approved → Dashboard

## API layer
`src/lib/api.js` — all calls via `json(path, opts)` helper. Gets Supabase session token, sets Authorization header.

## XLSX import (important pattern)
SheetJS is loaded from CDN (NOT npm) due to Rollup 4 / CommonJS incompatibility:
```html
<!-- index.html -->
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
```
Usage in components: `const XLSX = await Promise.resolve(window.XLSX)` (NOT `import("xlsx")`).
Never add xlsx back to package.json — it breaks the Vite 6 production build.

## Supabase client
`src/lib/supabase.js` — client singleton with anon key (public-safe).

## Deployment
- Vercel auto-deploys on push to main
- Build: `npm run build` (vite build)
- No backend code in this repo — all API calls go to Render backend

## Known patterns
- SSE streaming in BulkUpload: uses `res.body.getReader()` (web Fetch API supports ReadableStream)
- Admin detection: `user.id === ADMIN_USER_ID` (env var in backend, not stored in frontend)
- School invite: `POST /api/admin/invite-school` → Supabase `inviteUserByEmail` → magic link email
