# Mobile App — CLAUDE.md

## Stack
React Native + Expo SDK, TypeScript, EAS builds. Target: Android (primary), iOS (planned).

## Key dependencies
- `expo-camera` — CameraView for scanning
- `expo-image-picker` — gallery selection
- `@react-navigation/native` + `native-stack` — navigation
- `@supabase/supabase-js` — auth client
- `react-native-webview` — inline PDF/sheet viewer

## Project structure
```
src/
  lib/
    api.ts        — all backend API calls (single source of truth)
    auth.ts       — Supabase auth: sendEmailOtp, verifyEmailOtp, signOut
    supabase.ts   — Supabase client singleton
    pdf.ts        — photosToPDF: converts PhotoPage[] → PDF URI on device
    theme.ts      — color constants (c.bg, c.accent, c.success, c.warning, c.danger, c.purple, etc.)
    errorLog.ts   — in-memory error log, accessible from HomeScreen debug badge
  navigation/
    AppNavigator.tsx  — auth state, role detection, deep link config, stack navigator
  screens/
    LoginScreen.tsx           — email OTP: step 1 email, step 2 6-digit code
    HomeScreen.tsx            — teacher home: test list, credits, new paper, add notebook
    NewPaperScreen.tsx        — create test: capture QP → extract → details form → create
    ScanScreen.tsx            — scan copies: multi-copy queue → analyze all → results
    TestResultsScreen.tsx     — all results for one test, share button per result
    ResultDetailScreen.tsx    — full result: score ring, Q-by-Q breakdown, teacher comments, share; AssignModal bottom sheet to manually assign result to a student
    CorrectedCopiesScreen.tsx — browse all corrected copies across tests
    SelectTestScreen.tsx      — pick existing test to add more notebooks
    ShareResultScreen.tsx     — public share view (no auth required)
    StudentHomeScreen.tsx     — student home: results grouped by subject, stats
    StudentResultDetailScreen.tsx — student view: analysis + revision notes + practice questions
    ProfileScreen.tsx         — teacher profile: editable (name, subjects[], classes[]) via ✏️ Edit header btn; student profile: read-only; sign out
```

## Auth flow
1. `sendEmailOtp(email)` → Supabase sends 6-digit code via Resend SMTP
2. `verifyEmailOtp(email, token)` → Supabase verifies → session established
3. `AppNavigator` listens to `onAuthStateChange` → detects role via `detectRole()`
4. Role detection: tries `getMySchool()` (teacher) then `getStudentMe()` (student)
5. Routes to: teacher stack | student stack | unknown role screen

## NewPaperScreen flow
`capture` → `review` → `extracting` → `details` → `creating`
- Capture: photograph question paper pages (or skip)
- Extracting: calls `/api/analyzer/extract-paper` → auto-fills name, subject, marks, instructions
- Details form: name*, subject, class, total marks*, teacher name, leniency (1-5), instructions
- Creating: builds PDF from photos → POST `/api/analyzer/tests` → navigate to ScanScreen

## ScanScreen flow
`capture` → `copies` → `uploading` → `results`
- Capture: photograph pages of ONE student's copy → "Copy Done" → adds to queue
- Edit copy: ✏️ button on copies list reopens that copy's pages in camera
- Copies: queue view → "Add Another Copy" | "Analyze All (N)"
- Uploading: sequential — PDF per copy → SSE stream → collect results
- Results: score cards per copy with 🔗 share button

## Deep linking
```js
// AppNavigator.tsx
const linking = {
  prefixes: ["https://app.kelzo.ai", "kelzo://", ExpoLinking.createURL("/")],
  config: { screens: { ShareResult: "share/:token" } },
};
```

## API call pattern
All calls go through `src/lib/api.ts` → `request<T>(path, opts)` wrapper.
The wrapper: gets Supabase token → sets Authorization header → handles errors.
SSE exception: `analyzeSheet` uses XMLHttpRequest (RN has no ReadableStream).

Key api.ts methods (beyond basic CRUD):
- `updateMyTeacherProfile({ name, subjects, classes })` → `PATCH /api/school/teachers/me`
- `getSchoolStudents()` → `GET /api/school/students` — used by AssignModal
- `assignResult(id, studentId)` → `PATCH /api/analyzer/results/:id/assign`

## Share URL helper (branding.ts)
`shareUrl(token)` → `${BRAND.schoolPortalUrl}/share/${token}`
Used in ScanScreen, TestResultsScreen, ResultDetailScreen — never hardcode `https://app.kelzo.ai`.

## EAS build profiles (eas.json)
- `preview` → APK for testing (Android)
- `development` → dev client build
- `production` → AAB for Play Store

## Environment
- `EXPO_PUBLIC_API_URL` — backend URL (set in EAS secrets for production)

## Pending EAS setup
- SHA256 fingerprint for `assetlinks.json` → run `eas credentials --platform android`
- Apple Team ID for `apple-app-site-association`
