# EduGrade — Full Project Context
> Feed this file to any new Claude thread, Cursor session, or AI tool to get full context.
> Last updated: 2026-05-03

---

## What this product is

**EduGrade** (brand: Kelzo AI) — AI-powered answer sheet grading for schools.
- Teachers scan student answer sheets with their phone camera
- Claude AI grades question-by-question, gives marks + personalised feedback
- Students see results, revision notes, and practice MCQs

---

## Live URLs

| Surface | URL | Platform |
|---|---|---|
| Landing page | https://www.kelzo.ai | Vercel (compliance-ai project) |
| School web portal | https://app.kelzo.ai | Vercel (edugrade project) |
| Backend API | https://edugrade-yd4h.onrender.com | Render (free tier) |
| Mobile app | APK via EAS | Expo / React Native |

---

## Repository

**GitHub:** `UjjwalSingh5151/compliance-ai` (single monorepo, `main` branch)

```
compliance-ai/
├── landing/              # Static marketing site (www.kelzo.ai)
├── student-analyzer/     # React/Vite web portal (app.kelzo.ai)
├── backend/              # Node/Express API server
├── mobile/               # Expo/React Native app
├── FLOWS.md              # All screen flows (reference for design)
└── CONTEXT.md            # This file
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Mobile | Expo SDK 54, React Native 0.81, TypeScript, New Architecture enabled |
| Web portal | React 18, Vite, plain CSS-in-JS (no Tailwind) |
| Backend | Node.js, Express, ES modules |
| Database | Supabase (Postgres + Auth + Storage) |
| AI | Anthropic Claude claude-sonnet-4-6 (grading), claude-haiku-3-5 (notes/practice — planned) |
| Mobile navigation | React Navigation v7 (native stack) |
| Mobile builds | EAS (Expo Application Services) |

---

## Environment Variables

### Backend (Render)
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ADMIN_USER_ID=7f3cd39a-ec15-4053-9c6a-0afad38d2f46
CORS_ORIGINS=https://app.kelzo.ai,https://edugrade-yd4h.onrender.com
SERVE_FRONTEND=false
```

### Web portal (Vercel — edugrade project)
```
VITE_API_URL=https://edugrade-yd4h.onrender.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Mobile (EAS Secrets)
```
EXPO_PUBLIC_API_URL=https://edugrade-yd4h.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Key Files

### Backend
| File | Purpose |
|---|---|
| `backend/server.js` | Express app, CORS config, `/api/auth/me` route |
| `backend/lib/shared.js` | Supabase client, Claude client, `ADMIN_USER_ID`, `requireSchool`, credit deduction |
| `backend/routes/analyzer.js` | Test creation, answer sheet grading (SSE streaming), share token |
| `backend/routes/school.js` | School registration, members, credits |
| `backend/routes/student.js` | Student portal — results, revision notes, practice questions |
| `backend/routes/admin.js` | Admin panel — school CRM, credit management |
| `backend/routes/papers.js` | Question paper generation |

### Web Portal
| File | Purpose |
|---|---|
| `student-analyzer/src/App.jsx` | Root — auth state, role detection (admin/teacher/student), routing |
| `student-analyzer/src/lib/api.js` | All API calls (mirrors mobile api.ts) |
| `student-analyzer/src/lib/branding.js` | Central brand config — name, logo, URLs |
| `student-analyzer/src/lib/theme.js` | CSS color variables |
| `student-analyzer/src/components/ResultDetail.jsx` | Per-student result with Q-by-Q, teacher notes |
| `student-analyzer/src/components/AdminPanel.jsx` | Admin-only school/teacher CRM |
| `student-analyzer/public/.well-known/assetlinks.json` | Android App Links verification |
| `student-analyzer/public/.well-known/apple-app-site-association` | iOS Universal Links |
| `student-analyzer/vercel.json` | SPA rewrites + .well-known headers |

### Mobile
| File | Purpose |
|---|---|
| `mobile/src/navigation/AppNavigator.tsx` | Auth + role detection → teacher/student/unknown flow, deep link config |
| `mobile/src/lib/api.ts` | All API calls with TypeScript types |
| `mobile/src/lib/auth.ts` | Supabase auth helpers (getAccessToken, signOut) |
| `mobile/src/lib/branding.ts` | Central brand config (mirrors web branding.js) |
| `mobile/src/lib/theme.ts` | Color constants |
| `mobile/src/lib/errorLog.ts` | In-app error store (last 30 errors, copy to clipboard) |
| `mobile/src/lib/pdf.ts` | PDF creation from camera images (expo-print, expo-file-system/legacy) |
| `mobile/app.json` | Expo config — scheme "kelzo", EAS projectId, Android intentFilters |
| `mobile/eas.json` | EAS build profiles (preview=APK, production=AAB) |

### Mobile Screens
| Screen | Role | Purpose |
|---|---|---|
| `LoginScreen` | All | Email OTP login — step 1: email, step 2: 6-digit code (auto-submits) |
| `HomeScreen` | Teacher | New Paper / Add Notebook / View Copies + recent papers list; 👤 profile icon top-right |
| `NewPaperScreen` | Teacher | 5-step flow: capture QP → review → extracting (AI auto-fill) → details form → creating |
| `ScanScreen` | Teacher | Multi-copy queue: capture pages → "Copy Done" → queue → "Analyze All (N)" |
| `SelectTestScreen` | Teacher | Pick existing test to add notebook to |
| `TestResultsScreen` | Teacher | All results for a test (stats bar + list); 🔗 share button per result |
| `ResultDetailScreen` | Teacher | Per-student: Answer Sheet tab + Analysis tab (Q-by-Q + teacher notes); 🔗 share in header |
| `CorrectedCopiesScreen` | Teacher | All papers grouped by class → subject → tests |
| `ProfileScreen` | Teacher+Student | CRM data (name, subject, class, roll_no, school); sign out |
| `StudentHomeScreen` | Student | Results grouped by subject, 3 action buttons per test; 👤 profile icon top-right |
| `StudentResultDetailScreen` | Student | 4 tabs: Analysis / Sheet / Notes / Practice Quiz |
| `ShareResultScreen` | Public | Share link result — no auth needed, Q-by-Q read-only |
| `UnknownRoleScreen` | Unknown | Sign out prompt for users not in the system |

---

## Auth & Role System

### Web portal
- Supabase email/password auth
- After login: `api.getMySchool()` + `api.getAuthMe()` run in parallel
- `isAdmin = user.id === ADMIN_USER_ID` (env var on Render)
- Admin → full dashboard + Admin Panel
- School owner/teacher (approved) → dashboard
- Pending/rejected school → holding screen
- Student (email in student CRM) → student portal
- No match → SchoolSetup

### Mobile
- **Email OTP auth** (no passwords) — `sendEmailOtp(email)` + `verifyEmailOtp(email, token)`
- Supabase `signInWithOtp` + `verifyOtp({ type: "email" })` — OTP token length must be 6 digits (set in Supabase → Auth → Sign In/Providers → Email)
- Role detection in `AppNavigator.tsx`:
  1. `api.getMySchool()` → approved → Teacher flow
  2. `api.getStudentMe()` → found → Student flow
  3. Neither → UnknownRoleScreen
- Teacher profile: `GET /api/school/teachers/me` → matches by `req.user.email` ilike against `school_teachers`
- Student profile: `GET /api/student/me`

---

## Deep Linking

Share links: `https://app.kelzo.ai/share/{token}`
- App installed → `ShareResultScreen` (no auth needed)
- No app → browser → `ShareView` (web component)

Config:
- Android: `intentFilters` in `app.json`, `assetlinks.json` at `app.kelzo.ai/.well-known/`
  - **TODO:** Fill in SHA256 fingerprint — run `eas credentials --platform android`
- iOS: `associatedDomains` in `app.json`, `apple-app-site-association`
  - **TODO:** Fill in Apple Team ID
- Custom scheme fallback: `kelzo://share/{token}`

---

## NewPaperScreen Flow (current)

Steps: `capture` → `review` → `extracting` → `details` → `creating`

1. **capture** — Photograph question paper pages (or "Skip — fill details manually")
2. **review** — Preview pages, confirm or retake
3. **extracting** — Build PDF from photos → `POST /api/analyzer/extract-paper` → AI fills name, subject, marks, instructions
4. **details** — Form: name*, subject, class, total marks*, teacher name, leniency (1-5), instructions (pre-filled if scanned)
5. **creating** — Build PDF → `POST /api/analyzer/tests` → navigate to ScanScreen

Leniency scale: `1=Strict`, `2=Firm`, `3=Balanced` (default), `4=Lenient`, `5=Very Lenient`
Sent to backend as `leniency` integer; mapped to `LENIENCY_PROMPTS` in `backend/lib/shared.js`.

---

## ScanScreen Multi-Copy Queue (current)

Steps: `capture` → `copies` → `uploading` → `results`

```typescript
interface Copy { id: string; pages: PhotoPage[] }
interface ScanResult { copyId: string; copyNum: number; analysis: any; resultId?: string; shareToken?: string; error?: string; }
```

Key interactions:
- "Copy Done" → appends copy to queue, back to `copies` step
- ✏️ on a queued copy → loads pages back into camera step (`editingCopyId` state)
- "Save Copy" (while editing) → replaces copy in-place, back to `copies`
- "Analyze All (N)" → sequential: PDF per copy → SSE upload → collect results with `shareToken`
- Results list shows 🔗 share button per copy (only if `shareToken` present)

---

## SSE Streaming (critical mobile bug that was fixed)

React Native's `fetch` does NOT support `res.body.getReader()` (no ReadableStream).
Answer sheet grading uses SSE streaming. Fix in `mobile/src/lib/api.ts`:
```typescript
// Use XMLHttpRequest with onprogress — NOT fetch ReadableStream
const xhr = new XMLHttpRequest();
xhr.onprogress = () => {
  const newText = xhr.responseText.slice(processed);
  processed = xhr.responseText.length;
  // parse SSE lines
};
```

---

## PDF Creation (critical mobile fix)

`expo-file-system` SDK 54 deprecated `EncodingType.Base64`. Fix in `mobile/src/lib/pdf.ts`:
```typescript
import * as FileSystem from "expo-file-system/legacy";
// Use string "base64" not FileSystem.EncodingType.Base64
const data = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
```

---

## Camera (critical mobile fix)

`CameraView` in SDK 54 does not support children. Fix:
```tsx
// WRONG — crashes
<CameraView><View>...</View></CameraView>

// CORRECT — sibling with absolute position
<View style={{ flex: 1 }}>
  <CameraView style={StyleSheet.absoluteFill} />
  <View style={{ position: "absolute", zIndex: 10 }}>...</View>
</View>
```

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `schools` | School records, status (pending/approved/rejected), credits |
| `school_members` | Teacher↔school links, roles (owner/teacher), invite flow |
| `analyzer_tests` | Tests created by teachers |
| `analyzer_results` | Graded answer sheets — analysis JSON, share_token, teacher_comments |
| `analyzer_students` | Student records (name, roll_no, class, email) |
| `credit_transactions` | Credit debit log |
| `practice_sets` | Generated MCQ practice questions per result |
| `practice_attempts` | Student quiz submissions |

---

## Grading Flow (backend)

1. Teacher uploads answer sheet PDF + test ID
2. `POST /api/analyzer/tests/:id/analyze` (SSE stream)
3. Backend fetches question paper from test record
4. Sends both to Claude claude-sonnet-4-6 with grading prompt
5. Claude returns JSON: `{ marks_obtained, total_marks, questions: [{no, marks_awarded, marks_available, question, student_answer, expected_answer, feedback}], strengths, improvement_areas, overall_feedback }`
6. Result saved to `analyzer_results`, share_token generated
7. SSE events sent back to client: `{ type: "result", analysis, resultId, shareToken }`

---

## Branding / Rename Checklist

Current brand: **EduGrade** by **Kelzo AI**

To rebrand:
- `student-analyzer/src/lib/branding.js`
- `mobile/src/lib/branding.ts`
- `landing/index.html` (search `<!-- BRANDING: -->` comments)
- `mobile/app.json` — name, slug, package names
- `mobile/assets/` — icon.png, splash-icon.png, adaptive-icon.png

---

## AI Observability (Langfuse)

**File:** `backend/lib/langfuse.js`

- Traces every Claude grading call: model, prompt, tokens used, stop reason
- Scores each trace: `parse_success` (1/0) + `marks_sum_consistent` (1/0)
- Traces revision notes and practice question generation separately
- Gracefully disabled when `LANGFUSE_PUBLIC_KEY` is not set (no-op in local dev / staging)

### Langfuse env vars (Render)
```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com   # default, can omit
```

Get keys at: https://cloud.langfuse.com → Project Settings → API Keys

### What you see in Langfuse dashboard
- All grading traces with token costs per sheet
- `parse_success` score → identify prompts that fail to return valid JSON
- `marks_sum_consistent` score → identify hallucinated totals
- Filter by `schoolId` metadata to see per-school usage
- Compare prompt versions after changes (Langfuse prompt versioning)

---

## Testing

**Framework:** Vitest (ESM-native, no babel config needed)

```bash
cd backend && npm test           # run once
cd backend && npm run test:watch # watch mode
```

**Test files:**
| File | Covers |
|---|---|
| `backend/tests/setup.js` | Global mocks (Langfuse no-op, env vars) |
| `backend/tests/analyzer.test.js` | Tests, share endpoint, SSE grading stream |
| `backend/tests/student.test.js` | Student me/results, notes generation, practice scoring |

All tests mock the Claude client and Supabase — no real API calls in CI.

---

## Staging Environment ($0/month)

| Resource | What to use | Cost |
|---|---|---|
| Backend | Render free tier (2nd free service) | $0 |
| Database | Supabase free project #2 | $0 |
| Web portal | Vercel preview URL (auto-created per PR) | $0 |
| Mobile | EAS `staging` build profile | $0 |

**Setup:**
1. Create 2nd Supabase project → run same migrations
2. Create 2nd Render service → set vars from `backend/.env.staging.example`
3. Set `VITE_API_URL` in Vercel to point at staging Render URL for preview deploys
4. Push to `staging` branch → CI runs tests → deploys to staging Render

---

## CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

| Trigger | Jobs run |
|---|---|
| Push / PR to any branch | backend tests + web build check |
| Push to `staging` | + deploy to Render staging service |
| Push to `main` | + deploy to Render production service |

**GitHub Secrets needed:**
```
RENDER_STAGING_DEPLOY_HOOK   # Render dashboard → Service → Settings → Deploy Hook
RENDER_PROD_DEPLOY_HOOK      # same for production service
```

---

## Pending / TODO

### Infrastructure
- [ ] Fill SHA256 in `assetlinks.json` → run `eas credentials --platform android`
- [ ] Fill Apple Team ID in `apple-app-site-association`
- [ ] Set LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY on Render (both services)
- [ ] Add GitHub Secrets RENDER_STAGING_DEPLOY_HOOK + RENDER_PROD_DEPLOY_HOOK
- [ ] Set storage expiry policy in Supabase (answer sheets accumulate)

### Cost optimisation
- [ ] Implement prompt caching for question papers (60% Claude cost reduction)
- [ ] Switch revision notes + practice to claude-haiku-3-5 (75% cost reduction)
- [ ] Add OCR preprocessing pipeline (replaces vision tokens, 75% reduction)

### Features
- [ ] Profile screen editing — teachers can update their own CRM data (currently read-only)
- [ ] Web portal: "Open in App" button on `ShareView` for deep link (`kelzo://share/:token`)
- [ ] Web portal: AcceptInvite page (may be obsolete now OTP is live)
- [ ] Student result assignment: manual assign flow when roll_no doesn't auto-match
- [ ] Admin analytics: per-teacher breakdown on web portal
- [ ] Play Store submission
- [ ] Turn on Vercel Analytics (both projects)

### Code quality (from QC scan)
- [ ] Fix silent error handling in `Analytics.jsx` — no UI shown on API failure
- [ ] Extract hardcoded `https://app.kelzo.ai` to a constant in mobile
- [ ] Fix unhandled promise in `BulkUpload.jsx` SSE stream (user stuck on network failure)
- [ ] Fix credit deduction happening before file validation in backend
- [ ] Replace `any` types in `mobile/src/lib/api.ts` with proper interfaces
- [ ] Add request logging middleware to backend

---

## Build Commands

```bash
# Mobile — run in Expo Go
cd mobile && npx expo start

# Mobile — build APK (EAS)
cd mobile && eas build --platform android --profile preview

# Mobile — get Android SHA256 (for assetlinks.json)
cd mobile && eas credentials --platform android

# Web portal — local dev
cd student-analyzer && npm run dev

# Backend — local dev
cd backend && node server.js

# Backend — run tests
cd backend && npm test

# Landing — just open in browser
landing/index.html
```

---

## Cost Baseline (10 schools, 1000 scans/month)

| Item | Monthly |
|---|---|
| Claude API (grading) | $60 |
| Claude API (notes + practice) | $17 |
| Render backend | $7 |
| Supabase Pro | $30 |
| **Total** | **~$114** |
| Cost per sheet | $0.11 |
| Break-even price | ₹10-12/sheet |

**With optimisations (caching + model tiering + OCR):** ~$0.022/sheet = ₹1.8/sheet
