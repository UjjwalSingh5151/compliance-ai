# EduGrade — Complete Frontend Flows
> Import this into Figma using the "Figma AI" plugin or manually map each screen.
> Recommended tool: **Figma** (see Design Software section at bottom)

---

## Architecture Overview

```
www.kelzo.ai          → Landing page (static HTML)
app.kelzo.ai          → School web portal (React/Vite)
mobile app (Android)  → Teachers + Students (Expo/React Native)
```

---

## 1. LANDING PAGE  (www.kelzo.ai)

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
│  📸 Scan  🧠 AI grading  📊 Analytics       │
│  📲 Share  🏫 School mgmt  📄 Paper gen     │
├─────────────────────────────────────────────┤
│  WHO IS IT FOR (3 cards)                     │
│  🏫 Schools (web) | 👨‍🏫 Teachers (app) | 👨‍🎓 Students │
├─────────────────────────────────────────────┤
│  CTA BAND: Sign up free + Talk to us        │
├─────────────────────────────────────────────┤
│  Footer: School Login | support@ | © Kelzo   │
└─────────────────────────────────────────────┘
```

---

## 2. SCHOOL WEB PORTAL  (app.kelzo.ai)

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
kelzo.ai/share/{token}  OR  app.kelzo.ai#/share/{token}
  └── ShareView
        ├── Student name + score + test name
        ├── Q-by-Q feedback (read-only)
        └── "Download" / "View full" CTA
```

### 2.5 Student Portal (web, no login)
```
StudentPortal
  └── Enter roll no / name → search results
        └── StudentResultView
              └── Same as ResultDetail (read-only, no teacher notes)
```

---

## 3. MOBILE APP  (Teachers + Students)

### 3.1 Auth
```
App launch
  ├── Loading (check Supabase session)
  ├── Not logged in → LoginScreen
  │     └── Email + Password → HomeScreen
  └── Logged in → HomeScreen
```

### 3.2 HomeScreen
```
HomeScreen
  ├── Header: Logo | Credits badge | ⚠ Error count | Sign out
  ├── [📄 New Paper]          → NewPaperScreen
  ├── [📚 Add Notebook]       → SelectTestScreen
  ├── [📂 View Corrected Copies] → CorrectedCopiesScreen
  └── Recent Papers list
        └── Tap paper → TestResultsScreen
```

### 3.3 New Paper flow
```
NewPaperScreen
  Step 1 — Details
    ├── Test name (required)
    ├── Subject
    ├── Class / Section
    ├── Total marks (required)
    ├── [Next: Scan Question Paper →]
    └── [Skip — create without question paper]

  Step 2 — Capture question paper
    ├── Camera viewfinder
    ├── Gallery picker
    ├── Photo strip (last 4 thumbnails)
    └── Done (N) →

  Step 3 — Review pages
    ├── 3-column grid of thumbnails (✕ to remove)
    └── [Create →]

  Step 4 — Creating (spinner)
    └── Success → ScanScreen (for first notebook)
```

### 3.4 ScanScreen (notebook scanning)
```
ScanScreen (receives: test object)
  ├── Header: ← Home | Test name | Review (N) →
  ├── [✅ Test created! banner] (if freshly created)
  ├── Camera
  ├── Photo strip (last 5 thumbnails)
  ├── Controls: 🖼 Gallery | ⬤ Shutter | Done(N)
  └── Done → ReviewStep → Analyze →
        ├── Uploading (spinner + progress text)
        └── ResultView
              ├── Score: marks/total + %
              ├── Student name + roll
              ├── Feedback + Strengths + Improvements
              ├── [📷 Scan Next Notebook]
              └── [← Back to Home]
```

### 3.5 TestResultsScreen
```
TestResultsScreen (receives: test)
  ├── Header: ← Back | Test name + subject | [📷 Scan]
  ├── Stats bar: N scanned | Avg% | Total marks
  └── Results list
        └── Tap result → ResultDetailScreen
```

### 3.6 ResultDetailScreen
```
ResultDetailScreen (receives: resultId)
  ├── Header: ← Back | Test name | [Save comments]
  ├── Tab bar (if answer sheet exists):
  │     [Answer Sheet] [Analysis]
  │
  ├── Answer Sheet tab
  │     └── WebView (PDF via Google Docs Viewer / image)
  │
  └── Analysis tab
        ├── Score ring + marks/total
        ├── Student name + roll + class chips
        ├── [📄 View Answer Sheet] (switches tab)
        ├── Overall Feedback section
        │     ├── Feedback text
        │     ├── ✓ Strengths (green)
        │     └── → Improvements (amber)
        └── Q-by-Q Breakdown (expandable cards)
              └── Each card (collapsed): Q{n} | feedback preview | marks
                  Each card (expanded):
                    ├── QUESTION text
                    ├── STUDENT'S ANSWER
                    ├── EXPECTED ANSWER + reasoning
                    ├── MARKS AWARDED
                    ├── FEEDBACK TO STUDENT
                    └── TEACHER'S NOTE (editable)
```

### 3.7 CorrectedCopiesScreen
```
CorrectedCopiesScreen
  ├── Header: ← Back | "Corrected Copies" | N sheets · M papers
  └── Collapsible class sections
        └── 🏫 Class 10A  (tap to expand)
              └── ◆ Mathematics
                    ├── Chapter 5 Test (5 sheets) →
                    └── Unit Test 2 (3 sheets)   →
                  ◆ Science
                    └── Physics Test (2 sheets)  →
              [each paper → TestResultsScreen]
```

### 3.8 SelectTestScreen
```
SelectTestScreen
  ├── Header: ← Back | "Select Paper"
  ├── Hint: "Tap a paper to scan notebooks for it"
  └── Tests list → tap → ScanScreen
```

---

## 4. DEEP LINK FLOW (share link)

```
Teacher shares: https://app.kelzo.ai/share/{token}
  └── Recipient taps link
        ├── App installed? → Open in app → StudentResultView
        └── No app?       → Open in browser → ShareView (web)
```
*Deep linking requires: Expo Linking config + Universal Links setup*

---

## Design Software Recommendation

### Use: **Figma**
**Why:**
- Industry standard — designers and devs use the same file
- Export to React code via plugins (Locofy, Anima, Builder.io)
- **Figma MCP** — Claude Code can read your Figma file directly via the official MCP server and implement design changes automatically

**Workflow:**
1. You design in Figma (using this flows doc as reference)
2. Share Figma file URL with Claude Code (via Figma MCP)
3. Claude reads the design → implements pixel-accurate code
4. Or: paste Figma frame screenshots directly into Claude

**Figma MCP setup (for Claude Code):**
```
# In Claude Code settings, add:
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR_KEY"]
    }
  }
}
```

**Design tokens → code:** Your `theme.js` / `branding.js` already use CSS variables — these map 1:1 to Figma variables. Update both simultaneously when rebranding.

---

## Branding Change Checklist
When you rebrand (new name/logo/colors):

**Web:**
- [ ] `student-analyzer/src/lib/branding.js` — name, logo, URLs
- [ ] `landing/index.html` — search & replace product name (marked with `<!-- BRANDING: -->` comments)
- [ ] `student-analyzer/src/lib/theme.js` — color variables
- [ ] `student-analyzer/index.html` — `<title>` tag

**Mobile:**
- [ ] `mobile/src/lib/branding.ts` — name, logo, URLs
- [ ] `mobile/app.json` — `name`, `slug`, `android.package`, `ios.bundleIdentifier`
- [ ] `mobile/assets/` — replace `icon.png`, `splash-icon.png`, `adaptive-icon.png`

---
*Generated: 2025-05-02 | Repo: UjjwalSingh5151/compliance-ai*
