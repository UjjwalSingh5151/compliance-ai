# Backend — CLAUDE.md

## Stack
Node.js 22 + Express, ESM modules (`"type": "module"` in package.json), hosted on Render.

## Entry point
`server.js` → mounts all routers

## Route structure
```
/api/auth/*       → routes/auth.js       (verify JWT, get user info)
/api/school/*     → routes/school.js     (school CRUD, teacher/student CRM)
/api/analyzer/*   → routes/analyzer.js   (tests, answer sheet analysis, results, share)
/api/papers/*     → routes/papers.js     (question paper generation/transcription)
/api/analytics/*  → routes/analytics.js  (per-school / per-teacher analytics)
/api/student/*    → routes/student.js    (student portal: results, notes, practice)
/api/admin/*      → routes/admin.js      (super-admin: schools, credits)
```

## Shared utilities (lib/shared.js)
- `supabaseAdmin` — service-role Supabase client
- `getRequestUser(req)` — extracts user from Bearer token
- `getUserSchool(userId, email)` — resolves school + role for a user
- `requireSchool(req,res,next)` — middleware: sets req.user, req.school, req.schoolRole
- `requireAdmin(req,res,next)` — middleware: checks ADMIN_USER_ID
- `checkCredits(schoolId, amount)` — read-only pre-flight balance check (never deducts)
- `deductCredits(schoolId, amount, type, desc)` — atomic credit deduction (call AFTER successful Claude response)
- `uploadToStorage(bucket, path, buffer, contentType)` — Supabase Storage upload
- `fileToClaudeContent(file)` — converts multer file → Claude API content block
- `getPDFPageCount(buffer)` — estimates PDF pages without a library
- `LENIENCY_PROMPTS` — map of 1-5 → grading instruction strings

## AI observability (lib/langfuse.js)
- `traceGrading({ testId, schoolId, fileName, model, prompt, call })` — wraps Claude grading
- `scoreGrading(traceId, analysis, totalMarks)` — scores parse_success + marks_consistency
- `traceStudentGen({ type, studentId, resultId, call })` — wraps notes/practice generation
- Gracefully no-ops when LANGFUSE keys are absent

## Key patterns

### SSE streaming (analyzer.js)
Answer sheet analysis uses Server-Sent Events. The `/analyze` endpoint:
1. Accepts multipart FormData with one or more PDF files
2. For each file: calls Claude → parses JSON → saves to DB → sends `data: {...}\n\n`
3. Sends `data: [DONE]\n\n` at the end
Mobile uses XMLHttpRequest (not fetch) because React Native doesn't support ReadableStream.

### Auth middleware chain
```js
requireSchool → sets req.user (Supabase user), req.school, req.schoolRole ("owner"|"teacher")
requireAdmin  → sets req.user, checks ADMIN_USER_ID
```

### Teacher self-lookup + edit
`GET /api/school/teachers/me` — matches req.user.email against school_teachers.email (ilike).
`PATCH /api/school/teachers/me` — teacher can update own name, subjects[], classes[] (not email).
Both must be registered BEFORE any `/:id` routes to avoid "me" matching as an ID.

### Request logging middleware (server.js)
Logs every request on `res.finish`: `[INFO/WARN/ERROR] METHOD /path STATUS Nms`
Level: `>=500 → ERROR`, `>=400 → WARN`, else `INFO`.

### Credit deduction order (analyzer.js)
1. `checkCredits(schoolId, cost)` — early rejection if balance too low (no deduction)
2. Claude API call
3. `deductCredits(schoolId, cost, ...)` — only after successful grading response
Ensures failed/timed-out Claude calls never burn credits.

## Database tables (key ones)
- `schools` — id, name, owner_user_id, status (pending/approved/rejected), credits
- `school_members` — school_id, user_id, invited_email, role, status
- `school_teachers` — school_id, name, email, subjects (text[]), classes (text[]), phone  ← note: array columns, NOT subject/class_assigned strings
- `analyzer_students` — school_id, name, email, roll_no, class, section, academic_year
- `analyzer_tests` — school_id, teacher_id, name, subject, class, total_marks, leniency, instructions
- `analyzer_results` — test_id, student_id, marks_obtained, total_marks, analysis (JSONB), share_token, original_sheet_url
- `credit_transactions` — school_id, amount, type, description, balance_after

## Tests (Vitest)
```
backend/tests/
  setup.js          — stubs Langfuse, sets env vars
  analyzer.test.js  — 6 tests: GET tests, share, analyze SSE
  student.test.js   — 5 tests: me, results, notes (cached+generate), practice attempt
```
Run: `npm test` | `npm run test:watch` | `npm run test:coverage`

## Analytics per-student breakdown (analytics.js)
`GET /api/analytics/teacher/:teacherId` now returns:
- `allStudents[]` — every student with `testBreakdown[]` (resultId, testName, marks, total, score%)
- `topStudents[]` / `needsAttention[]` — kept for backwards compat (derived from allStudents)
Frontend renders `AllStudentsTable` (expandable rows) in `Analytics.jsx`.

## Deployment
- Auto-deploy: disabled (manual via Render dashboard for safety)
- Node version: 22
- Build command: `npm install`
- Start command: `node server.js`
