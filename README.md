# ABII Summit — Session 2 Live Interactive Layer

A zero-install, zero-maintenance live layer on top of `abii-session2.html` for a one-time training session of ~50 attendees.

## What's in the box

| File | Purpose |
|---|---|
| `abii-session2.html` | **Your deck** (unchanged outside the 5 allowed surgical edits). Presented on the main screen. |
| `attendees.html` | **Single mobile-first page** that attendees scan into via one QR code. Houses all 16 interactions with an "Interaction X / 16" counter, offline-tolerant, one anonymous identity per device. |
| `live-dashboard.html` | **Presenter desktop view** with realtime aggregates per interaction — word clouds, % correct, country rollups, live feed. Same visual language as the deck. |
| `QUESTIONS.md` | Ambiguities flagged during build (slide 68/86 correction, authored copy). |
| `PROGRESS.md` | Build notes. Safe to delete after the event. |

All three HTML files are **standalone** — no build step, no backend server. They talk to each other through **Firebase Realtime Database** (free tier), with a **localStorage fallback** so everything still works locally if Firebase is not configured yet.

---

## Why Firebase Realtime Database (and not Supabase / Google Sheets)?

1. **Truly realtime push** — dashboard refreshes via `.on('value', …)` without polling. No query budget to worry about with 50 attendees.
2. **No server, no DB schema migrations** — the data tree is created automatically on first write.
3. **Free tier is more than enough** — Spark plan gives 1 GB storage + 10 GB/month egress. A 50-person session writes ~16 × 50 = 800 small JSON docs total (~50 KB).
4. **Anonymous auth or permissive rules** — you don't need attendees to sign in. One QR → they're in.
5. **Supabase is also great** but requires a Postgres schema + row-level-security you'd have to configure. Overkill for one event.
6. **Google Sheets + Apps Script** would work but has a 6-minute execution limit per script, no true realtime, and you'd rate-limit quickly if 50 people submit at once.

---

## Quickstart (local rehearsal, no Firebase yet)

You can run a full rehearsal on your laptop with nothing more than a browser — in "local mode", `attendees.html` writes to `localStorage` and `live-dashboard.html` polls `localStorage` every 1.5 s.

```powershell
# From a PowerShell terminal in the workspace folder:
python -m http.server 5500
# Then in your browser:
#   Attendee view:  http://localhost:5500/attendees.html
#   Dashboard:      http://localhost:5500/live-dashboard.html?admin=1
#   Your deck:      http://localhost:5500/abii-session2.html
```

(Any static server works — `npx serve`, VS Code Live Server, etc.)

**Note on local mode**: because `localStorage` is per-browser, the dashboard will only see submissions from the SAME browser. For true multi-device realtime (which is what you need on event day), configure Firebase below.

---

## Set up Firebase (do this once, takes ~4 minutes)

### 1. Create the project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name: `abii-summit` (or anything). Skip Google Analytics.
3. In the left sidebar, click **Build → Realtime Database → Create Database**.
4. Region: pick the closest (e.g. *United States (us-central1)* or *Europe-west1*).
5. Choose **Start in test mode**. (We'll tighten rules next.)

### 2. Add a web app

1. On the project home, click the **`</>` Web** icon.
2. Nickname: `abii-summit-web`. **Do not** enable hosting yet.
3. Firebase gives you a config object. You need these 5 fields:
   - `apiKey`
   - `authDomain`
   - `databaseURL`  ← **critical** — format is `https://abii-summit-XXXX-default-rtdb.firebaseio.com`
   - `projectId`
   - `appId`

### 3. Paste the config into BOTH files

Open `attendees.html` and `live-dashboard.html`, find the `FIREBASE_CONFIG` constant near the top of the `<script>` block, and replace:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...your-real-key...",
  authDomain: "abii-summit-abcde.firebaseapp.com",
  databaseURL: "https://abii-summit-abcde-default-rtdb.firebaseio.com",
  projectId: "abii-summit-abcde",
  appId: "1:012345678901:web:abcdef..."
};
```

Save. Reload both files. You should see the dashboard status chip change from **"Local mode"** to **"Live · streaming"** (green dot pulsing).

### 4. Lock down database rules (recommended for the event)

In the Firebase console → **Realtime Database → Rules**, paste:

```json
{
  "rules": {
    "sessions": {
      "$sid": {
        ".read": true,
        ".write": true,
        "$iid": {
          "$uid": {
            ".validate": "newData.hasChild('ts')"
          }
        }
      }
    }
  }
}
```

This allows anyone with the URL to write one record per UUID per interaction, and anyone to read the aggregates. For a time-boxed public workshop this is the simplest safe model. **Delete the project** the week after the event and nothing sensitive persists.

---

## Deployment options (pick the easiest)

### A. Netlify Drop (recommended, 60 seconds)

1. Go to https://app.netlify.com/drop
2. Drag-and-drop the **entire folder** (the one containing `attendees.html`).
3. Netlify gives you a URL like `https://abii-summit-xyz.netlify.app`.
4. QR-code URL is: `https://abii-summit-xyz.netlify.app/attendees.html`

### B. Vercel

```powershell
npm i -g vercel
vercel --prod
```

### C. GitHub Pages

1. Push the folder to a GitHub repo.
2. Settings → Pages → Deploy from branch → `main` / `/ (root)`.
3. URL: `https://<username>.github.io/<repo>/attendees.html`

### D. Your internal AB-InBev CDN / SharePoint

Any static-file host works. No server code is needed.

---

## QR code — one URL for all 50 attendees

The URL you encode is:

```
https://<your-host>/attendees.html?s=abii-2026
```

The `?s=abii-2026` parameter is the **session id**. Both `attendees.html` and `live-dashboard.html` default to `abii-2026` when the query string is missing, so you can keep it simple.

### Generate the QR

- Easiest: https://qrcode.tec-it.com/en (paste URL, download PNG, drop it into slide 2/86 of the deck).
- Offline PowerShell:
  ```powershell
  # Uses a free public API. Replace the URL inside "data=" with yours.
  $url = "https://your-host/attendees.html?s=abii-2026"
  Invoke-WebRequest "https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=$([uri]::EscapeDataString($url))" -OutFile qr.png
  ```
- Or in VS Code: install the *QR Code Generator* extension.

**Print it big** on your screen and/or include it on slide 2 of `abii-session2.html`.

---

## Running the live session — the full flow

| Moment | What you do |
|---|---|
| **T-30 min** | Open `live-dashboard.html?s=abii-2026` on your laptop, full-screen, second monitor / projector output is fine. Confirm the green **"Live · streaming"** chip. Leave it open. |
| **T-5 min** | Open your deck (`abii-session2.html`) on the main screen. Navigate to slide 2/86 where the QR code lives. |
| **T-0** | Attendees scan → land on `attendees.html?s=abii-2026` on their phones. Their submissions stream to your dashboard in realtime. |
| **Each interaction** | Say "OK team, let's move to Interaction 5." The counter on their phones is the reference. Wait for responses on the dashboard, then reveal results. |
| **Post-event** | Export data if you need it (see "Exporting data" below), then reset or delete the Firebase project. |

### During the session: best UX decision
Auto-advance is **NOT** recommended for your audience. Facilitator-controlled is better because:
- You pace the room ("OK, 30 seconds left").
- People who finish early don't run ahead and lose context.
- It matches how you'll narrate the deck slide-by-slide.

The attendee view uses **explicit `Next →` / `← Back`** buttons, plus keyboard arrows on desktop for rehearsal.

---

## Resetting data between rehearsals

### Method 1 — admin panel (recommended)

Open the dashboard with `?admin=1`:

```
https://<your-host>/live-dashboard.html?s=abii-2026&admin=1
```

You'll see a red "Admin" panel at the bottom of each interaction with two buttons:

- **Reset Interaction N** — clears just that interaction.
- **Reset ALL interactions** — clears the full session bucket.

Both clear Firebase **and** any local rehearsal data on your device.

### Method 2 — Firebase console

Realtime Database → find `/sessions/abii-2026` → click the **×** next to it.

### Method 3 — full fresh session id

Just change the session id in the URL (`?s=abii-2026-dryrun`, `?s=abii-2026-live`). Each id is isolated. Nothing to clean up.

---

## Exporting data after the event

Firebase console → Realtime Database → click the three dots on the root node → **Export JSON**.

The tree looks like:

```json
{
  "sessions": {
    "abii-2026": {
      "i1": {
        "<uuid>": { "text": "...", "ts": 1745234567890 }
      },
      "i2": {
        "<uuid>": { "idx": 2, "letter": "C", "correct": true, "ts": ... }
      },
      ...
    }
  }
}
```

Drop that JSON into Excel / Python for post-event reporting.

---

## Accessibility & mobile constraints (what we've already handled)

- ✅ 44×44 px+ tap targets everywhere.
- ✅ 16 px base font size (no iOS zoom on focus).
- ✅ Sticky header with live `Interaction X / 16` counter.
- ✅ Prevents double-submit — anonymous UUID stored in `localStorage`, one response per interaction per device.
- ✅ Offline-tolerant — submissions are queued and flushed when the connection returns.
- ✅ `prefers-reduced-motion` respected.
- ✅ Semantic HTML (`<header>`, `<nav>`, `<main>`, proper `<label>`s, `aria-live` on the counter/toast).
- ✅ Works at 320×568 viewport without horizontal scroll.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard shows "Local mode · no cloud" | Firebase config still has the `Demo-Replace` placeholder. Paste your real config. |
| Dashboard shows "Reconnecting…" in amber | Client lost WiFi. It will auto-reconnect. |
| Attendee sees "Offline — will retry" chip | They lost data connectivity. Their submission is queued. |
| "Syncing…" chip stays stuck on an attendee phone | Firebase rules are rejecting writes. Re-paste the rules from section **Set up Firebase → 4**. |
| Word cloud is blank | Wait for at least 3 submissions. It renders the top 60 tokens (stop-words filtered). |
| Deck (`abii-session2.html`) looks different | Please verify only the 5 allowed edits were applied. They are listed in `QUESTIONS.md`. |

---

## The 16 interactions (quick reference)

| # | Deck slide | Type | Dashboard view |
|---|---|---|---|
| 1 | 3 / 86 | Free text — expectations | Word cloud + feed |
| 2 | 12 / 86 | MC · AOP is a joint plan | % correct + distribution |
| 3 | 15 / 86 | 2 × Yes/No · Mega & Expansion | Stacked bars |
| 4 | 16 / 86 | MC · Mega Brand criteria | % correct |
| 5 | 22 / 86 | MC · S&M/NR 1.3x–2.5x | % correct |
| 6 | 23 / 86 | MC · S&M rules (logistics = no) | % correct |
| 7 | 28 / 86 | MC · 70% BTL in underdeveloped | % correct |
| 8 | 36 / 86 | Free text · reallocation | Live feed (mirrored inside deck) |
| 9 | 47 / 86 | 4 questions · 2 restaurant + 2 off-trade | Bars × 4, avg % correct |
| 10 | 54 / 86 | Country selector | **Summed** AC/BGT/LE across countries |
| 11 | 57 / 86 | 2 questions · Corona execution + distribution | Reveal inside deck |
| 12 | 65 / 86 | MC · Off-trade entrance display | % correct |
| 13 | 74 / 86 | Country selector · KPIs | **Summed** AC/BGT/LE |
| 14 | 77 / 86 | MC · "So What?" framework | % correct |
| 15 | 78 / 86 | Free text · commitment | Word cloud + feed |
| 16 | 85 / 86 | 3 fields · Stop / Start / Track | Word cloud + commitment cards |

---

## License / Attribution

Built for AB-InBev ABII Summit 2026 — internal training use.
External dependencies loaded via CDN:
- `firebase-app-compat` + `firebase-database-compat` 10.12.2 (Apache 2.0)
- `wordcloud2.js` 1.2.2 (MIT)
- Google Fonts · Montserrat + JetBrains Mono (OFL)
