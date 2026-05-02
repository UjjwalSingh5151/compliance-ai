# EduGrade — Complete Frontend Flows
> Use this file as a reference for Figma design or any redesign work.
> Last updated: 2026-05-02

---

## Architecture Overview

```
www.kelzo.ai          → Landing page (static HTML, Vercel)
app.kelzo.ai          → School web portal (React/Vite, Vercel)
edugrade-yd4h.onrender.com → Backend API (Node/Express, Render)
mobile app (Android)  → Teachers + Students (Expo/React Native)
```

---

## 1. LANDING PAGE  (www.kelzo.ai)

**File:** `landing/index.html`

```
┌─────────────────────────────────────────────┐
│  Nav: Logo | Features | Contact | School Login→ │
├─────────────────────────────────────────────┤
│  HERO                                        │
│  "Grade answer sheets in seconds, not hours" │
│  [Get started free] [See how it works ↓]    │
├─────────────────────────────────────────────┤
│  STATS BAR: ~30s/sheet | Q-by-Q | Any sub   │
├─────────────────────────────────────────────┤
│  FEATURES GRID (2×3)                         │
│  Scan  AI grading  Analytics                │
│  Share  School mgmt  Paper gen              │
├─────────────────────────────────────────────┤
│  WHO IS IT FOR (3 cards)                     │
│  Schools (web) | Teachers (app) | Students  │
├─────────────────────────────────────────────┤
│  CTA BAND: Sign up free + Talk to us        │
├─────────────────────────────────────────────┤
│  Footer: School Login | support@ | © Kelzo  │
└─────────────────────────────────────────────┘
```

---

## 2. SCHOOL WEB PORTAL  (app.kelzo.ai)

**Files:** `student-analyzer/src/`

### 2.1 Auth Flow
```
Landing [School Login →]
  └── AuthScreen
        ├── Login tab    → email + password → Dashboard
        ├── Sign up tab  → email + password → SchoolSetup
        └── Magic link   → email → check inbox

  SchoolSetup (first time)
    └── Enter school name + type → PendingApproval
          └── Admin approves → Dashboard
```

### 2.2 Dashboard (school admin / teacher)
```
Dashboard
  ├── Header: School name | Credits | Nav links | Sign out
  ├── Quick stats: tests, sheets, students, avg score
  ├── Recent tests list
  └── Nav:
        ├── Tests → TestResults → ResultDetail
        ├── New Test → NewTest (form + question paper upload)
        ├── Bulk Upload → BulkUpload
        ├── Students → StudentList → StudentDetail
        ├── Analytics → Analytics
        ├── Paper Generator → PaperGenerator
        ├── School Settings → SchoolSettings
        └── (admin only) Admin Panel → AdminPanel
                                        ├── School CRM
                                        ├── Teacher CRM
                                        └── Credits management
```

### 2.3 Test Results flow
```
Dashboard → Tests list
  └── TestResults (test detail)
        ├── Header: test name | subject | Scan count | avg score
        ├── Results list (student cards with score badges)
        └── ResultDetail (per student)
              ├── Tab: Answer Sheet (PDF inline viewer)
              └── Tab: Analysis
                    ├── Score ring + student info
                    ├── Overall feedback
                    ├── Strengths (green) + Improvements (amber)
                    ├── Q-by-Q breakdown (expandable cards)
                    │     └── Each card: Q text | Student answer |
                    │         Expected answer | Marks | Feedback
                    └── Teacher comment per question + Save
```

### 2.4 Share view (public, no login)
```
app.kelzo.ai/share/{token}
  └── ShareView
        ├── Student name + score + test name
        ├── Q-by-Q feedback (read-only)
        └── "Download" / "View full" CTA
```

### 2.5 Student Portal (web, email login)
```
StudentPortal
  └── Student sees their own results list
        └── StudentResultView
              ├── Score + test info
              ├── Q-by-Q analysis (read-only)
              ├── Revision notes (generate / view)
              └── Practice questions (MCQ quiz)
```

---

## 3. MOBILE APP  (Teachers + Students)

**Files:** `mobile/src/`

### 3.1 Auth + Role Detection
```
App launch
  ├── Loading spinner (check Supabase session)
  ├── Not logged in → LoginScreen
  └── Logged in → Role detection
        ├── getMySchool() → approved → Teacher flow (HomeScreen)
        ├── getStudentMe() → found → Student flow (StudentHomeScreen)
        └── Neither → UnknownRoleScreen (sign out prompt)
```

### 3.2 TEACHER FLOW

#### HomeScreen
```
HomeScreen
  ├── Header: Logo | Credits badge | Error count badge | Sign out
  ├── [New Paper]          → NewPaperScreen
  ├── [Add Notebook]       → SelectTestScreen
  ├── [View Corrected Copies] → CorrectedCopiesScreen
  └── Recent Papers list
        └── Tap paper → TestResultsScreen
```

#### New Paper flow
```
NewPaperScreen
  Step 1 — Details
    ├── Test name (required)
    ├── Subject
    ├── Class / Section
    ├── Total marks (required)
    └── [Next: Scan Question Paper] or [Skip]

  Step 2 — Capture question paper
    ├── Camera viewfinder
    ├── Gallery picker
    └── Done (N pages captured)

  Step 3 — Review pages
    ├── Grid of thumbnails (tap X to remove)
    └── [Create]

  Step 4 — Creating (spinner)
    └── Success → ScanScreen (for first notebook)
```

#### ScanScreen (notebook scanning)
```
ScanScreen (receives: test object)
  ├── Header: Back | Test name | Review (N)
  ├── [Test created! banner] (if freshly created)
  ├── Camera
  ├── Photo strip (last 5 thumbnails)
  ├── Controls: Gallery | Shutter | Done(N)
  └── Done → ReviewStep → Analyze
        ├── Uploading (spinner + progress)
        └── ResultView
              ├── Score: marks/total + %
              ├── Student name + roll
              ├── Feedback + Strengths + Improvements
              ├── [Scan Next Notebook]
              └── [Back to Home]
```

#### TestResultsScreen
```
TestResultsScreen (receives: test)
  ├── Header: Back | Test name + subject | [Scan]
  ├── Stats bar: N scanned | Avg% | Total marks
  └── Results list
        └── Tap result → ResultDetailScreen
```

#### ResultDetailScreen (teacher view)
```
ResultDetailScreen (receives: resultId)
  ├── Header: Back | Test name | [Save comments]
  ├── Tab bar: [Answer Sheet] [Analysis]
  │
  ├── Answer Sheet tab
  │     └── WebView (PDF via Google Docs Viewer / image)
  │
  └── Analysis tab
        ├── Score ring + marks/total
        ├── Student name + roll + class chips
        ├── [View Answer Sheet] button
        ├── Overall Feedback
        ├── Strengths (green) + Improvements (amber)
        └── Q-by-Q Breakdown (expandable cards)
              └── Each card (expanded):
                    ├── QUESTION text
                    ├── STUDENT'S ANSWER
                    ├── EXPECTED ANSWER
                    ├── MARKS AWARDED
                    ├── FEEDBACK TO STUDENT
                    └── TEACHER'S NOTE (editable)
```

#### CorrectedCopiesScreen
```
CorrectedCopiesScreen
  ├── Header: Back | "Corrected Copies" | N sheets · M papers
  └── Collapsible class sections
        └── Class 10A (tap to expand)
              └── Mathematics
                    ├── Chapter 5 Test (5 sheets) →
                    └── Unit Test 2 (3 sheets) →
                  Science
                    └── Physics Test (2 sheets) →
              [each paper → TestResultsScreen]
```

#### SelectTestScreen
```
SelectTestScreen
  ├── Header: Back | "Select Paper"
  ├── Hint: "Tap a paper to scan notebooks for it"
  └── Tests list → tap → ScanScreen
```

---

### 3.3 STUDENT FLOW

#### StudentHomeScreen
```
StudentHomeScreen
  ├── Header: Logo | Student name + Roll no | Sign out
  ├── Stats row: Tests taken | Average score
  └── Results grouped by SUBJECT (section headers)
        └── [Subject: CHEMISTRY]
              └── Test card: "Solutions Test"  May 1  82%
                    ├── [Results]   → StudentResultDetail (Analysis tab)
                    ├── [Notes]     → StudentResultDetail (Notes tab)
                    └── [Practice]  → StudentResultDetail (Practice tab)
```

#### StudentResultDetailScreen
```
StudentResultDetailScreen (receives: resultId, initialTab)
  ├── Header: Back | Test name | Subject
  ├── Tab bar: Analysis | Sheet | Notes | Practice
  │
  ├── Analysis tab
  │     ├── Score ring (% + marks/total)
  │     ├── Student name + roll + class
  │     ├── [View Answer Sheet] button (if exists)
  │     ├── Overall feedback text
  │     ├── Strengths (green bullets)
  │     ├── Areas to Improve (amber bullets)
  │     ├── Q-by-Q breakdown (expandable cards)
  │     │     └── Each card: Q text | Your answer | Expected | Feedback
  │     └── Quick access: [Generate Notes] [Practice Quiz]
  │
  ├── Sheet tab (if answer sheet exists)
  │     └── WebView — Google Docs Viewer for PDF, direct for images
  │
  ├── Notes tab
  │     ├── Empty state → [Generate Revision Notes] button
  │     ├── Loading state → "Claude is writing your notes…"
  │     └── Notes view → scrollable text + [Regenerate]
  │
  └── Practice tab
        ├── Empty state → [Generate Practice Questions] button
        ├── Loading state → "Claude is generating 8 questions…"
        ├── Quiz view (8 MCQ questions)
        │     ├── Each question: text + A/B/C/D radio options
        │     ├── Progress: "X/8 answered"
        │     ├── [Submit] button (disabled until all answered)
        │     └── [New Questions] button
        └── Results view (after submit)
              ├── Score banner: X/8 correct + %
              ├── Per-question result: correct/wrong + explanation
              └── [Try New Questions]
```

---

## 4. SHARE LINK FLOW

```
Teacher taps [Share] → copies https://app.kelzo.ai/share/{token}
  └── Recipient taps link
        ├── App installed → deep link → ShareResultScreen (no login needed)
        │     ├── Student name + score + test name
        │     ├── Q-by-Q feedback (read-only, expandable)
        │     └── Fully self-contained — works without account
        └── No app → browser → ShareView (web, same content)

Deep link config:
  Android:  intentFilters in app.json (App Links)
            assetlinks.json at app.kelzo.ai/.well-known/
  iOS:      associatedDomains in app.json (Universal Links)
            apple-app-site-association at app.kelzo.ai/.well-known/
  Custom scheme fallback: kelzo://share/{token}
```

---

## 5. BRANDING CHANGE CHECKLIST

When you rebrand (new name / logo / colors):

**Web:**
- [ ] `student-analyzer/src/lib/branding.js` — name, logo, URLs
- [ ] `landing/index.html` — search & replace product name (marked `<!-- BRANDING: -->`)
- [ ] `student-analyzer/src/lib/theme.js` — color variables
- [ ] `student-analyzer/index.html` — `<title>` tag

**Mobile:**
- [ ] `mobile/src/lib/branding.ts` — name, logo, URLs
- [ ] `mobile/app.json` — `name`, `slug`, `android.package`, `ios.bundleIdentifier`
- [ ] `mobile/assets/` — replace `icon.png`, `splash-icon.png`, `adaptive-icon.png`

---

## 6. DESIGN SOFTWARE

### Figma (recommended)
**Free plan is fine for solo/small team use.**
- Unlimited personal files
- Design + prototype
- Share with devs (view-only link, free)
- Limitations: max 3 team projects, no version history beyond 30 days

**Workflow:**
1. Design screens in Figma using this doc as reference
2. Export frames as PNG → paste into Claude for implementation
3. Or use Figma MCP (Claude Code) to read your file directly

**Figma MCP setup:**
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR_KEY"]
    }
  }
}
```

### Free alternatives
| Tool | Best for |
|------|----------|
| **Figma** (free) | Recommended — industry standard |
| **Penpot** | 100% free & open source, Figma-like |
| **Framer** | Free tier, great for interactive prototypes |
| **Excalidraw** | Quick wireframes only |

---

*File: `FLOWS.md` at repo root — update this whenever a new screen is added.*
*Repo: UjjwalSingh5151/compliance-ai*
