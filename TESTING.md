# EduGrade — Testing Guide

This guide explains how to run tests after making changes, and what each test checks.
You do not need to be a developer to run these tests.

---

## What tests do

Tests automatically check that the app is working correctly.
They act like a robot that clicks through the app and checks:
- The page loads
- Buttons do what they should
- The API returns the right data
- Nothing crashes

If a test fails after a code change, it means something broke.
**Run tests before deploying any change.**

---

## Before you run tests

You need two things running at the same time in two separate terminal windows:

**Terminal 1 — Start the backend:**
```
cd backend
node server.js
```
You should see: `EduGrade server running on http://localhost:3001`

**Terminal 2 — Start the frontend (dev server):**
```
cd student-analyzer
npm run dev
```
You should see: `Local: http://localhost:5174/`

Leave both running. Open a **third terminal** to run the tests.

---

## Running tests

From the project root folder (`cluade_projects`):

### Run all tests
```
npm test
```

### Run only backend API tests (fast, no browser needed)
```
npm run test:api
```

### Run only UI/browser tests
```
npm run test:smoke
```

### Run tests with a visual browser (great for debugging)
```
npm run test:ui
```
This opens a window where you can watch the tests click through the app in real time.

---

## Understanding test results

### ✅ All green = good to deploy
```
✓ backend /api/health returns ok
✓ app loads login screen
✓ login screen shows email and password fields
...
8 passed
```

### ❌ Red = something broke
```
✗ login screen shows email and password fields
  Expected: visible
  Received: hidden
```
This tells you exactly which part of the app stopped working.

---

## Test files explained

| File | What it tests |
|------|---------------|
| `tests/api.spec.js` | Backend API endpoints — security, correct responses |
| `tests/smoke.spec.js` | Frontend UI — page loads, login screen, basic interactions |

---

## After making a code change

1. Make your change
2. Start the backend and frontend (see above)
3. Run `npm test`
4. If all green → safe to deploy
5. If any red → read the error message and fix the issue before deploying

---

## Adding a new test

Ask Claude Code (or Cursor) to write a new test. Tell it:
- What you want to test
- Which file to add it to (`tests/api.spec.js` for backend, `tests/smoke.spec.js` for UI)

Example prompt:
> "Add a Playwright test in tests/smoke.spec.js that checks the Students tab shows a search box"

Tests are written in plain English descriptions like:
```js
test("Students tab shows a search box", async ({ page }) => {
  // ... Claude writes the actual code
});
```

---

## Troubleshooting

**"Connection refused" error**
→ Backend isn't running. Start it with `cd backend && node server.js`

**"Timeout" error**
→ Frontend isn't running. Start it with `cd student-analyzer && npm run dev`

**Tests worked yesterday but fail today**
→ Run `npm install` in the root folder first, then try again

**Want to see what the test is doing visually?**
→ Run `npm run test:ui` for the interactive mode
