# EduGrade — Full Project Context
> Feed this file to any new AI thread, Cursor session, or design tool to get full context.
> Last updated: 2026-05-04 (9-feature batch)

---

## What this product is

**EduGrade** (brand: Kelzo AI) — AI-powered answer sheet grading for Indian schools.
- Teachers scan student answer sheets with their phone camera
- AI grades question-by-question, gives marks + personalised feedback
- Students see results, revision notes, and practice MCQs
- Teachers get class-level analytics: error heatmaps, at-risk students, concept breakdowns

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
| AI | Anthropic API — sonnet model for grading, haiku for notes/practice |
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
| `backend/lib/shared.js` | Supabase client, AI client, `ADMIN_USER_ID`, `requireSchool`, `checkCredits()` (read-only pre-flight), `deductCredits()` (post-success only) |
| `backend/routes/analyzer.js` | Test creation, answer sheet grading (SSE streaming), share token |
| `backend/routes/school.js` | School registration (auto-approve + 100 free credits), members, credits |
| `backend/routes/student.js` | Student portal — results, revision notes, practice questions, learning fingerprint |
| `backend/routes/admin.js` | Admin panel — school CRM, credit management, usage metrics, accuracy benchmark |
| `backend/routes/analytics.js` | Class analytics (heatmap, error areas, at-risk), school overview |
| `backend/routes/papers.js` | Question paper generation |

### Web Portal
| File | Purpose |
|---|---|
| `student-analyzer/src/App.jsx` | Root — auth state, role detection (admin/teacher/student), routing |
| `student-analyzer/src/lib/api.js` | All API calls (mirrors mobile api.ts) |
| `student-analyzer/src/lib/branding.js` | Central brand config — name, logo, URLs |
| `student-analyzer/src/lib/theme.js` | CSS color variables |
| `student-analyzer/src/components/ResultDetail.jsx` | Per-student result with Q-by-Q, teacher notes, mark override, concept/cognitive badges |
| `student-analyzer/src/components/ClassAnalytics.jsx` | Class-level report: heatmap, error areas, at-risk, all students table |
| `student-analyzer/src/components/AdminPanel.jsx` | Admin-only school/teacher CRM + metrics + benchmark tabs |
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
| `TestResultsScreen` | Teacher | All results for a test (stats bar + list); 📊 insights + 🔗 share per result |
| `ResultDetailScreen` | Teacher | Per-student: Answer Sheet tab + Analysis tab (Q-by-Q + teacher notes + mark override) |
| `InsightsScreen` | Teacher | Class analytics for a test: Q heatmap, top error concepts, at-risk students |
| `CorrectedCopiesScreen` | Teacher | All papers grouped by class → subject → tests |
| `ProfileScreen` | Teacher+Student | CRM data; teachers: name/subjects[]/classes[]/school — editable; students: read-only; sign out |
| `StudentHomeScreen` | Student | Results grouped by subject; Learning Fingerprint card; 3 action buttons per test |
| `StudentResultDetailScreen` | Student | 4 tabs: Analysis / Sheet / Notes / Practice Quiz |
| `ShareResultScreen` | Public | WhatsApp-optimised parent result card — score, grade, summary, focus areas, share buttons |
| `UnknownRoleScreen` | Unknown | Sign out prompt for users not in the system |

---

## Auth & Role System

### Web portal
- Supabase email/password auth
- After login: `api.getMySchool()` + `api.getAuthMe()` run in parallel
- `isAdmin = user.id === ADMIN_USER_ID` (env var on Render)
- Admin → full dashboard + Admin Panel (Schools / Teachers / Credits / Metrics / Benchmark)
- School owner/teacher (approved) → dashboard
- Pending/rejected school → holding screen
- Student (email in student CRM) → student portal
- No match → SchoolSetup (auto-approves + 100 free credits instantly)

### Mobile
- **Email OTP auth** (no passwords) — `sendEmailOtp(email)` + `verifyEmailOtp(email, token)`
- Supabase `signInWithOtp` + `verifyOtp({ type: "email" })` — OTP token length must be 6 digits
- Role detection in `AppNavigator.tsx`:
  1. `api.getMySchool()` → approved → Teacher flow
  2. `api.getStudentMe()` → found → Student flow
  3. Neither → UnknownRoleScreen
- Teacher profile: `GET /api/school/teachers/me` → **editable** via `PATCH /api/school/teachers/me`
- Student profile: `GET /api/student/me`
- Students use the same LoginScreen as teachers — role auto-detected after OTP login

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

---

## ScanScreen Multi-Copy Queue (current)

Steps: `capture` → `copies` → `uploading` → `results`

Key interactions:
- "Copy Done" → appends copy to queue, back to `copies` step
- ✏️ on a queued copy → loads pages back into camera step
- "Analyze All (N)" → sequential: PDF per copy → SSE upload → collect results with `shareToken`
- Results list shows 🔗 share button per copy (only if `shareToken` present)

---

## SSE Streaming (critical mobile note)

React Native's `fetch` does NOT support `res.body.getReader()`.
Answer sheet grading uses SSE streaming via `XMLHttpRequest` with `onprogress` in `mobile/src/lib/api.ts`.

---

## PDF Creation (critical mobile note)

`expo-file-system` SDK 54 deprecated `EncodingType.Base64`.
Fix in `mobile/src/lib/pdf.ts`: use `expo-file-system/legacy` and string `"base64"` encoding.

---

## Camera (critical mobile note)

`CameraView` in SDK 54 does not support children.
Pattern: `CameraView` with `StyleSheet.absoluteFill`, sibling `View` with `position: "absolute", zIndex: 10`.

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `schools` | School records, status (pending/approved/rejected), credits |
| `school_members` | Teacher↔school links, roles (owner/teacher), invite flow |
| `school_teachers` | Teacher CRM: name, subjects[], classes[], email |
| `analyzer_tests` | Tests created by teachers |
| `analyzer_results` | Graded answer sheets — analysis JSON, share_token, teacher_comments |
| `analyzer_students` | Student records (name, roll_no, class, email) |
| `credit_transactions` | Credit debit log |
| `practice_sets` | Generated MCQ practice questions per result |
| `practice_attempts` | Student quiz submissions |
| `override_log` | Teacher mark corrections — fine-tuning dataset + benchmark data |

### override_log DDL (run in Supabase SQL editor)
```sql
CREATE TABLE override_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES analyzer_results(id) ON DELETE CASCADE,
  question_no integer NOT NULL,
  subject text, class text,
  question_text text, student_answer text, expected_answer text,
  ai_marks_awarded numeric, ai_marks_available numeric, ai_reasoning text,
  override_marks numeric NOT NULL, override_reason text,
  teacher_user_id uuid, school_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON override_log(result_id);
CREATE INDEX ON override_log(school_id);
```

---

## Grading Flow (backend)

1. Teacher uploads answer sheet PDF + test ID
2. `POST /api/analyzer/tests/:id/analyze` (SSE stream)
3. Backend fetches question paper from test record
4. Sends both to AI with grading prompt
5. AI returns JSON per question: `{ no, marks_awarded, marks_available, question, student_answer, expected_answer, feedback, concept_tag, cognitive_level }`
6. Also returns: `marks_obtained, total_marks, strengths[], improvement_areas[], overall_feedback`
7. Result saved to `analyzer_results`, share_token generated
8. SSE events sent back to client: `{ type: "result", analysis, resultId, shareToken }`

### Error Taxonomy (in every graded question)
- `concept_tag` — specific concept tested, e.g. "Newton's third law", "Photosynthesis"
- `cognitive_level` — one of: `"recall"` | `"application"` | `"analysis"`

---

## Analytics Features

### Class Analytics (`GET /api/analytics/class/:testId`)
Returns:
- `totalPapers`, `classAvg`
- `scoreDistribution` — bands: 0–39, 40–59, 60–79, 80–100
- `questionHeatmap` — per question: `no`, `successRate`, `attempts`, `concept_tag`, `cognitive_level`
- `topErrorAreas` — concept_tags with highest failure count + cognitive level
- `atRisk` — students below `atRiskThreshold` (40%) with score + marks
- `students` — all students ranked by score

### School Overview (`GET /api/analytics/school-overview`)
For principals — summary per test across all classes.

### Learning Fingerprint (`GET /api/student/fingerprint`)
Returns per student (aggregated across all results):
- `weakConcepts` — recurring concept_tags they fail, with count
- `cogBreakdown` — % marks lost in recall / application / analysis
- `subjectTrends` — per subject: avg score + trend direction (improving/declining/stable)
- `totalResultsAnalyzed`

---

## Admin Features (AdminPanel.jsx)

| Tab | Content |
|---|---|
| Schools | School CRM — list, approve/reject, credits view |
| Invite | Create teacher invite links |
| Credits | Add/deduct credits per school |
| 📈 Metrics | Total papers (all time / this month / MoM growth %), active schools, per-school breakdown |
| 📊 Benchmark | AI accuracy vs teacher overrides — overall agreement %, per subject breakdown, Export CSV |

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

- Traces every AI grading call: model, prompt, tokens used, stop reason
- Scores each trace: `parse_success` (1/0) + `marks_sum_consistent` (1/0)
- Traces revision notes and practice question generation separately
- Gracefully disabled when `LANGFUSE_PUBLIC_KEY` is not set

### Langfuse env vars (Render)
```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

---

## Testing

**Framework:** Vitest (ESM-native)

```bash
cd backend && npm test           # run once
cd backend && npm run test:watch # watch mode
```

| File | Covers |
|---|---|
| `backend/tests/setup.js` | Global mocks (Langfuse no-op, env vars) |
| `backend/tests/analyzer.test.js` | Tests, share endpoint, SSE grading stream |
| `backend/tests/student.test.js` | Student me/results, notes generation, practice scoring |

All tests mock the AI client and Supabase — no real API calls in CI.

---

## Staging Environment ($0/month)

| Resource | What to use | Cost |
|---|---|---|
| Backend | Render free tier (2nd free service) | $0 |
| Database | Supabase free project #2 | $0 |
| Web portal | Vercel preview URL (auto-created per PR) | $0 |
| Mobile | EAS `staging` build profile | $0 |

---

## CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

| Trigger | Jobs |
|---|---|
| Push / PR to any branch | backend tests + web build check |
| Push to `staging` | + deploy to Render staging |
| Push to `main` | + deploy to Render production |

---

## Pending / TODO

### Infrastructure
- [ ] Fill SHA256 in `assetlinks.json` → run `eas credentials --platform android`
- [ ] Fill Apple Team ID in `apple-app-site-association`
- [ ] Set LANGFUSE keys on Render
- [ ] Add GitHub Secrets: RENDER_STAGING_DEPLOY_HOOK + RENDER_PROD_DEPLOY_HOOK
- [ ] Set storage expiry policy in Supabase

### Cost optimisation
- [ ] Prompt caching for question papers (60% AI cost reduction)
- [ ] Switch revision notes + practice to haiku model (75% cost reduction)
- [ ] OCR preprocessing pipeline (replaces vision tokens, 75% reduction)

### Features
- [x] Profile screen editing — teachers update name/subjects[]/classes[]
- [x] Student result assignment — AssignModal in mobile + web
- [x] Admin analytics — per-teacher + per-student breakdown
- [x] Class-level analytics dashboard — InsightsScreen (mobile) + ClassAnalytics.jsx (web)
- [x] Error taxonomy — concept_tag + cognitive_level per graded question
- [x] Student learning fingerprint — LearningFingerprintCard on StudentHomeScreen
- [x] WhatsApp parent share card — redesigned ShareResultScreen with grade + WA deep-link
- [x] Accuracy benchmark report — AdminPanel Benchmark tab (AI vs teacher agreement %)
- [x] Teacher mark override — override form in QuestionCard, logs to override_log
- [x] Self-serve onboarding — auto-approve + 100 free credits on signup
- [x] Usage metrics dashboard — AdminPanel Metrics tab (MoM growth, per-school)
- [x] Personalized practice questions — targets recurring weak concept_tags
- [ ] Web portal: "Open in App" button on ShareView
- [ ] Play Store submission
- [ ] Vercel Analytics (both projects)

---

## Build Commands

```bash
# Mobile — run in Expo Go
cd mobile && npx expo start

# Mobile — build APK (EAS)
cd mobile && eas build --platform android --profile preview

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
| AI API (grading) | $60 |
| AI API (notes + practice) | $17 |
| Render backend | $7 |
| Supabase Pro | $30 |
| **Total** | **~$114** |
| Cost per sheet | $0.11 |
| Break-even price | ₹10-12/sheet |

**With optimisations (caching + model tiering + OCR):** ~$0.022/sheet = ₹1.8/sheet
