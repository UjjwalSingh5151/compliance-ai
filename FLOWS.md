# EduGrade — Complete UI Flows & Screen Specifications
> Design reference for Figma, Framer, or any AI design tool.
> Feed this alongside CONTEXT.md for a complete design brief.
> Last updated: 2026-05-04

---

## Design System

### Color Palette
```
Background:  #0f0f13   dark base
Card:        #1a1a22   elevated surface
Border:      #2a2a36   subtle dividers
Accent:      #7c6af7   primary purple — buttons, links, badges
Text:        #f0f0f5   primary text
Text Mid:    #9090a8   secondary text
Text Dim:    #5a5a72   placeholder / label text
Success:     #4ade80   green — correct, improving, high scores
Warning:     #fbbf24   amber — partial, needs work, medium scores
Danger:      #f87171   red — wrong, at-risk, low scores
Purple:      #a78bfa   cognitive level tags, notes UI
```

### Typography
- Screen titles: 20px, 700 weight
- Stat numbers: 22px, 800 weight
- Section labels: 11–12px, 700 weight, ALL CAPS, letter-spacing 0.8
- Body: 13–14px, 400–600 weight
- Captions/meta: 10–11px, dim color

### Spacing & Radius
- Screen padding: 16–20px horizontal
- Card radius: 12–16px
- Card border: 1px solid Border color (#2a2a36)
- Gap between components: 8–16px
- Bottom safe area: 40px padding

### Reusable Components
- **Stat Card** — card bg, rounded 12, centered large value (22px 800wt, accent color) + small label below
- **Score Pill** — colored border + lightly tinted bg, percentage 17px bold + marks/total 10px below
- **Heat Bar** — full-width gray track, colored fill (green ≥70%, amber 40–69%, red <40%)
- **Tag Pill** — tinted bg, 9px text, radius 4 — used for concept_tag (accent) and cognitive_level (purple)
- **Action Button** — tinted bg + colored border + icon emoji + label, equal flex width
- **Section Header** — ALL CAPS 11px label left + count right, subtle separator

---

## Architecture Overview

```
www.kelzo.ai          Landing page (static HTML, Vercel)
app.kelzo.ai          School web portal (React/Vite, Vercel)
Backend API           Node/Express, Render
Mobile app (Android)  Teachers + Students (Expo/React Native)
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

  SchoolSetup (first time — auto-approved)
    └── Enter school name + type
          └── Instant approval + 100 free credits
                └── "You're all set!" success screen → Dashboard (2s delay)
```

### 2.2 Dashboard (school admin / teacher)
```
Dashboard
  Header: School name | Credits | Nav links | Sign out
  Quick stats: tests, sheets, students, avg score
  Recent tests list
  Nav:
    Tests          → TestResults → ResultDetail
    New Test       → NewTest
    Bulk Upload    → BulkUpload
    Students       → StudentList → StudentDetail
    Analytics      → Analytics (per-teacher + per-student)
    Paper Generator→ PaperGenerator
    School Settings→ SchoolSettings
    Admin Panel*   → AdminPanel (admin only)
                       Schools tab  — school CRM, approve/reject
                       Invite tab   — teacher invite links
                       Credits tab  — add/deduct credits
                       Metrics tab  — paper counts + MoM growth
                       Benchmark tab— AI accuracy vs teacher overrides
```

### 2.3 Test Results flow
```
Dashboard → Tests list
  TestResults (test detail)
    Header: test name | subject | scan count | avg score
    [Class Report] button → ClassAnalytics overlay
    Results list (student cards with score bars)
    ResultDetail (per student)
      Tab: Answer Sheet (PDF inline viewer)
      Tab: Analysis
        Score ring (% large) + marks/total
        Student info: name, roll, class chips
        Overall feedback paragraph
        Strengths (green bullets)
        Areas to Improve (amber bullets)
        Q-by-Q breakdown (expandable cards)
          Each card:
            Q number + marks badge (green/amber/red)
            concept_tag pill (accent/purple)
            cognitive_level pill (purple)
            QUESTION text
            STUDENT'S ANSWER
            EXPECTED ANSWER
            FEEDBACK text
            Teacher comment input field + Save
            [Override marks] toggle
              New marks number input
              Reason textarea
              [Save Override] button
```

### 2.4 ClassAnalytics overlay (NEW)
```
Triggered by [Class Report] button in TestResults
  Stat row: Papers | Class avg | At-risk count | Questions
  SCORE DISTRIBUTION
    Band chips: 0-39 | 40-59 | 60-79 | 80-100 with student counts
  QUESTION SUCCESS RATE
    Per question: Q# | concept_tag | cognitive_level | HeatBar | %
  TOP CLASS-WIDE ERRORS (red tinted section)
    Ranked: # . concept tag . cognitive level . [student count badge]
  AT-RISK STUDENTS (amber, below 40%)
    Avatar | name + roll | score % | marks/total
  ALL STUDENTS (ranked, show first 10 + expand toggle)
    # | name + roll | score % | marks/total
```

### 2.5 Admin Metrics tab (NEW)
```
AdminPanel → Metrics tab
  Stat row:
    Total Papers (all time)
    Papers This Month
    MoM Growth % (green up / red down arrow)
    Approved Schools count
  Per-school table:
    School name | Papers this month | Papers all time | Last active
```

### 2.6 Admin Benchmark tab (NEW)
```
AdminPanel → Benchmark tab
  Headline: "AI Accuracy: XX% agreement with teachers"
  Total overrides: N corrections logged
  Per-subject rows:
    Subject | Overrides count | Agreement % | bar visualization
  [Export CSV] button
```

### 2.7 Share view (public, no login)
```
app.kelzo.ai/share/{token}
  ShareView
    Student name + score + test name
    Q-by-Q feedback (read-only, expandable)
    Brand footer
```

### 2.8 Student Portal (web)
```
StudentPortal
  Student sees their own results list
  StudentResultView
    Score + test info
    Q-by-Q analysis (read-only)
    Revision notes (generate / view)
    Practice questions (MCQ quiz)
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
Header
  Left:  Logo "EduGrade"
  Right: [Credits badge] [Error count badge] [Profile icon]

Body
  [New Paper]             large accent card -> NewPaperScreen
  [Add Notebook]          large secondary card -> SelectTestScreen
  [View Corrected Copies] large secondary card -> CorrectedCopiesScreen

RECENT PAPERS (section label)
  Paper card per test:
    Test name + date
    Class + subject
    [Insights] link (small) + chevron -> TestResultsScreen
```

#### NewPaperScreen (5 steps)
```
Step 1 — CAPTURE QUESTION PAPER
  Camera viewfinder (full screen)
  Bottom: [Gallery] [Shutter button] [Done N]
  Link: "Skip — fill details manually"

Step 2 — REVIEW PAGES
  Grid of page thumbnails (tap X to remove)
  [+ Add more pages]
  [Use these pages ->]

Step 3 — EXTRACTING (loading)
  Spinner centered
  "Extracting test details..."

Step 4 — DETAILS FORM
  Test Name* [input]
  Subject    [input]
  Class      [input]
  Total Marks* [number input]
  Leniency   [Balanced dropdown — Strict/Firm/Balanced/Lenient/Very Lenient]
  Instructions [textarea, pre-filled if scanned]
  [Create Test ->]

Step 5 — CREATING
  Spinner centered
  -> Success -> ScanScreen
```

#### ScanScreen (multi-copy notebook queue)
```
CAPTURE step
  Header: <- | Test name | [Review N copies]
  Camera viewfinder full screen
  Bottom strip: last 5 photo thumbnails
  Controls: [Gallery] [Shutter] [Copy Done]

COPIES QUEUE step
  Header: <- | Test name
  List of queued copies:
    Copy N — X pages — [Edit pencil] [Delete]
  Footer:
    [+ Add Another Copy]
    [Analyze All (N) ->]

UPLOADING step
  "Copy X of N..."
  Progress bar + %

RESULTS step
  Per copy row:
    Done: student name | score % | [Share link]
    Error: "Copy N failed" | [Retry]
  Footer:
    [Scan More Notebooks]
    [Back to Home]
```

#### TestResultsScreen
```
Header
  <- Back | Test name + subject | [Insights icon] [Scan icon]

Stats bar
  N scanned | Avg% | /Total marks

Results list
  Per student card:
    Student name + roll number
    Score bar + % + marks/total
    [Share link icon]
  Tap card -> ResultDetailScreen
```

#### ResultDetailScreen (Teacher)
```
Header: <- | Test name | [Share link]

Tab bar: [Answer Sheet] [Analysis]

Answer Sheet tab:
  WebView — PDF via Google Docs Viewer / image fallback

Analysis tab:
  Score ring (circular, colored border by score)
    Large %  inside
    Marks/total below
  Student name + roll + class chips

  Overall Feedback text paragraph

  STRENGTHS (green tinted section)
    Bullet list

  IMPROVEMENTS (amber tinted section)
    Bullet list

  Q-BY-Q BREAKDOWN
    Per question expandable card:
      Collapsed: Q# | concept_tag pill | cognitive_level pill | marks badge | chevron
      Expanded:
        QUESTION text
        STUDENT'S ANSWER
        EXPECTED ANSWER
        MARKS AWARDED
        FEEDBACK TO STUDENT
        TEACHER'S NOTE (editable input)
        [Override marks] toggle button
          -> Override form:
               New marks [number input]
               Reason [text input]
               [Save Override] button
```

#### InsightsScreen (NEW — Class Analytics)
```
Header: <- Back | "Class Report"
Subheader: test name

Test meta: Subject . Class . Section

Stat scroll row (horizontal scroll):
  [Papers: N] [Avg: X%] [At-risk: N] [Questions: N]

SCORE DISTRIBUTION
  Row of band chips: [0-39: N] [40-59: N] [60-79: N] [80+: N]

QUESTION SUCCESS RATE
  Per question row:
    Left: Q# | concept_tag pill | cognitive_level pill
    Right: HeatBar (colored by %) | % value | "N papers" caption

TOP CLASS-WIDE ERRORS (red tinted card)
  Per concept:
    Rank# . Concept tag . Cognitive level badge . [count badge]

AT-RISK STUDENTS (amber tinted card, below 40%)
  Per student row:
    Avatar (initials circle) | Name + Roll | Score % | Marks/Total

ALL STUDENTS (ranked list)
  Rank# | Name + Roll | Score % | Marks/Total
  (border separated rows)
```

#### CorrectedCopiesScreen
```
Header: <- | "Corrected Copies" | N sheets total

Collapsible sections by class:
  > CLASS 10-A (tap to expand)
      CHEMISTRY
        . Chapter 5 Test  5 sheets  ->
        . Unit Test 2     3 sheets  ->
      MATHEMATICS
        . Finals          8 sheets  ->
  > CLASS 9-B (collapsed)
```
#### SelectTestScreen
```
Header: <- | "Select Paper"
Hint text: "Tap a paper to scan notebooks for it"
Tests list (each row taps to ScanScreen)
```

#### ProfileScreen (Teacher — editable)
```
Header: <- | "Profile" | [Edit] button

Avatar circle (initials)
Name (large)
Email (dim)

SCHOOL section
  School name (read-only)

SUBJECTS section
  Pills: [Chemistry] [Biology] (tappable in edit mode)

CLASSES section
  Pills: [10-A] [10-B] [9-A]

[Sign Out] button (danger color)

Edit mode (when Edit tapped):
  Name field (editable)
  Subjects (comma-separated input)
  Classes (comma-separated input)
  [Save Changes] button
```

---

### 3.3 STUDENT FLOW

#### StudentHomeScreen
```
Header
  Left:  Logo + student name + roll number
  Right: [Profile icon]

Stats row (separator)
  Tests taken: N  |  Average: X%

Learning Fingerprint card (NEW — shown after 2+ tests)
  Header row:
    Left: "My Learning Profile" + "N tests analyzed"
    Right: chevron (expand/collapse)
  Always visible: subject trend chips (horizontal scroll)
    [Chemistry up 74%] [Maths -> 81%] [Physics down 68%]
  Expanded:
    WHERE YOU LOSE MARKS
      [Recall: 20%] [Application: 55%] [Analysis: 25%]
    RECURRING WEAK CONCEPTS
      [Newton's Laws x4] [Momentum x3] [Friction x2] (red chips)

Results (SectionList grouped by subject)
  Section header: SUBJECT NAME (caps) + "N tests"
  Per test card:
    Top row: Test name | Date | Score pill (% + marks/total, colored)
    Action row (3 equal buttons):
      [Results]   -> StudentResultDetail (Analysis tab)
      [Notes]     -> StudentResultDetail (Notes tab)
      [Practice]  -> StudentResultDetail (Practice tab)
```

#### StudentResultDetailScreen (4 tabs)
```
Header: <- | Test name | Subject

Tab bar: [Analysis] [Sheet] [Notes] [Practice]

ANALYSIS TAB
  Score ring (colored circular border)
    % large + grade letter inside
    Marks/total below ring
  Student name + roll + class chips

  Overall feedback text paragraph

  STRENGTHS (green tinted section)
    Bullet points

  FOCUS AREAS (amber tinted section)
    Numbered list

  Q-by-Q breakdown (expandable cards)
    Collapsed: Q# | marks/total badge
    Expanded: Q text | Your answer | Expected answer | Feedback

  Quick links: [Generate Notes] [Practice Quiz]

SHEET TAB
  WebView — Google Docs Viewer for PDF, image for photos

NOTES TAB
  Empty state:
    Notebook emoji
    "Revision Notes"
    "AI writes personalised notes explaining every concept you missed"
    [Generate Revision Notes] button (purple)
  Loading state:
    Spinner (purple)
    "Writing your revision notes... (this takes ~20 seconds)"
  Filled state:
    Scrollable notes text
    [Regenerate Notes] button

PRACTICE TAB
  Empty state:
    Target emoji
    "Practice Questions"
    "AI generates 8 MCQs targeting your specific weak concepts"
    [Generate Practice Quiz] button (green)
  Loading state:
    Spinner (green)
    "Generating 8 practice questions... (this takes ~20 seconds)"
  Quiz state (8 MCQ cards):
    Progress: "X/8 answered"
    Per question card:
      Question text
      (A) option
      (B) option
      (C) option
      (D) option
    [Submit (X/8)] button (disabled until all answered)
    [New Questions] button
  Results state:
    Score banner: X/8 correct (% large)
    Per question result:
      Green check or red X
      Your answer / Correct answer
      Explanation text
    [Try New Questions] button
```

---

### 3.4 SHARE RESULT SCREEN (Public — no login)

#### ShareResultScreen (NEW — WhatsApp-optimised)
```
Header
  Left:  Logo "EduGrade"
  Right: "Result Card" label

MAIN CARD
  Top row:
    Score ring (colored border, tinted bg)
      % large (22px 800wt, colored)
      Grade letter (B+/A/etc., 13px 700wt)
    Name column:
      Student name (18px bold)
      Roll chip
      Class . Section chip
      Marks/total (accent color, 14px bold)
  Divider
  Test name + Subject
  Divider
  Overall feedback (3 lines max, ellipsis)

STRENGTHS section (green border)
  Bullet list (up to 2)

FOCUS AREAS section (amber border)
  Numbered list (up to 3)

NEXT STEP section (accent tinted bg)
  Single practice hint text

Action row:
  [Share on WhatsApp]  (green #25D366 bg, full text)
  [Share]              (secondary card style)

[Show question breakdown] toggle

Q-by-Q breakdown (when expanded):
  Per question card (expandable):
    Collapsed: Q# | preview text | marks badge | chevron
    Expanded:
      QUESTION
      STUDENT'S ANSWER
      EXPECTED ANSWER
      FEEDBACK
      CONCEPT
      COGNITIVE LEVEL
```

---

## 4. SHARE LINK FLOW

```
Teacher taps [Link icon] on result
  -> Copies https://app.kelzo.ai/share/{token} to clipboard
  -> Teacher pastes in WhatsApp / SMS to parent

Parent taps link:
  App installed  -> deep link -> ShareResultScreen (no login needed)
                    WhatsApp-optimised result card
                    Score + grade + summary + focus areas
                    [Share on WhatsApp] [Share] buttons
  No app         -> browser  -> ShareView (web, same content)

Deep link config:
  Android: intentFilters in app.json + assetlinks.json
  iOS:     associatedDomains in app.json + apple-app-site-association
  Fallback: kelzo://share/{token}
```

---

## 5. SCREEN INVENTORY FOR DESIGN TOOLS

### Mobile screens — complete list
| Screen | Role | Primary purpose | Key UI pattern |
|---|---|---|---|
| LoginScreen | All | Email OTP sign in | 6-box digit grid, auto-submit on last digit |
| HomeScreen | Teacher | Launch point | 3 large action cards + recent list |
| NewPaperScreen | Teacher | Create a test | 5-step wizard with camera |
| ScanScreen | Teacher | Grade notebooks | Camera + queue + batch upload + results |
| SelectTestScreen | Teacher | Pick test for scanning | Simple list |
| TestResultsScreen | Teacher | See all results for test | Stats bar + result cards |
| ResultDetailScreen | Teacher | Per-student grading detail | 2-tab: sheet + analysis with Q cards |
| InsightsScreen | Teacher | Class-level analytics | Stat row + heatmap + error areas + students |
| CorrectedCopiesScreen | Teacher | Browse all graded papers | Collapsible class accordion |
| ProfileScreen | Teacher | View/edit profile | Avatar + pills + edit mode |
| StudentHomeScreen | Student | Results dashboard | Stats + fingerprint card + subject sections |
| StudentResultDetailScreen | Student | Detailed result + tools | 4-tab: analysis / sheet / notes / practice |
| ShareResultScreen | Public | Parent result card | Score ring + summary + WA share button |
| UnknownRoleScreen | Any | Error state | Centered message + sign out |

### Web portal screens — complete list
| Screen | Role | Primary purpose | Key UI pattern |
|---|---|---|---|
| AuthScreen | All | Login / signup | Two-tab form |
| SchoolSetup | New school | Register school | Simple form + instant success |
| Dashboard | Teacher | Navigation hub | Sidebar + stats + recent tests |
| TestResults | Teacher | All results for test | Cards with score bars |
| ResultDetail | Teacher | Per-student detail | Tabs + score ring + Q cards + override |
| ClassAnalytics | Teacher | Class heatmap | Stat row + heatmap + error areas + table |
| Analytics | Teacher/Admin | Drill-down analytics | Per-teacher + per-student tables |
| AdminPanel | Admin | Platform management | 5-tab: schools / invite / credits / metrics / benchmark |
| StudentPortal | Student | Results dashboard | List + detail with notes/practice |
| ShareView | Public | Parent-facing result | Read-only Q list + footer |
| PaperGenerator | Teacher | Create question papers | AI generate + transcribe tabs |

---

## 6. BRANDING CHANGE CHECKLIST

When rebranding (new name / logo / colors):

Web:
  student-analyzer/src/lib/branding.js  — name, logo, URLs
  landing/index.html                    — search BRANDING: comments
  student-analyzer/src/lib/theme.js     — color variables
  student-analyzer/index.html           — title tag

Mobile:
  mobile/src/lib/branding.ts     — name, logo, URLs
  mobile/app.json                — name, slug, android.package, ios.bundleIdentifier
  mobile/assets/                 — icon.png, splash-icon.png, adaptive-icon.png

---

*File: FLOWS.md at repo root — update whenever a new screen is added.*
*Repo: UjjwalSingh5151/compliance-ai*
