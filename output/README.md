# Authenticity Validator for Academia — HTML/CSS/JS Edition

This is a fully client-side rewrite of the project. There is **no Flask
backend, no MySQL database, and no Python** anywhere — everything runs in
the browser as plain HTML, CSS, and JavaScript.

## How to run it

No build step, no server required. Just open `index.html` in a browser,
or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8080
```

then visit `http://localhost:8080`.

## What changed from the original Flask version

| Original (Python) | This version (JS) |
|---|---|
| Flask + MySQL + JWT auth | `localStorage`-based accounts and sessions (`assets/js/store.js`) |
| Email OTP verification on signup | Removed — accounts are active immediately |
| Password reset via emailed OTP | Simplified — enter your email, then set a new password directly |
| `pdfplumber` / `python-docx` / `pytesseract` text extraction | `pdf.js`, `mammoth.js`, `Tesseract.js` running in-browser (`assets/js/extract.js`) |
| scikit-learn TF-IDF plagiarism check | Same algorithm, hand-ported to JS (`assets/js/ai-engine.js`) |
| AI-content heuristic, citation check, grammar heuristic | Same logic, ported line-for-line to JS |
| OpenCV QR decode + SHA-256 certificate hash check | A lighter text-based equivalent using `crypto.subtle` SHA-256 |
| Server PDF report / CSV / Excel export endpoints | Generated client-side with `jsPDF` and `SheetJS` (`assets/js/report.js`) |

## Data storage

Everything (accounts, uploaded-document records, notifications) is stored
in the browser's `localStorage`. This means:
- Data is **per-browser** — it won't sync across devices, and clearing
  site data/cookies will wipe it.
- There's no real security — passwords are stored in plain text in
  `localStorage`. This is fine for a demo/college project running
  locally, but **do not use this for real user data.**

## Demo login

```
Email:    admin@authvalidator.local
Password: Admin@12345
```
This account has the `super_admin` role and can see the Admin Panel
with platform-wide stats and a user list.

## File structure

```
index.html            Landing page
login.html            Login
register.html         Sign up (no OTP step)
forgot-password.html  Password reset (no OTP step)
dashboard.html        Stats + recent activity
upload.html           Upload + run AI analysis
history.html          Document history, search/filter, CSV/Excel export
reports.html          Report downloads + notifications
profile.html          Account info
settings.html         Theme toggle, notification prefs
admin.html            Admin-only platform stats + user list
404.html              Not found page

assets/css/style.css  All styling (unchanged)
assets/js/
  background.js        Animated canvas background (unchanged)
  ui.js                 Toasts, badges, score rings (unchanged)
  store.js              localStorage "database" layer  (NEW)
  ai-engine.js           Plagiarism/AI/citation/grammar analysis (NEW, ported)
  extract.js             PDF/DOCX/image text extraction (NEW)
  report.js              PDF report + CSV/Excel export (NEW)
  api.js                 Same interface as before, now backed by the above
```

## Known limitations of the client-side version

- **OCR (Tesseract.js)** runs entirely in the browser and is slower and
  less accurate than server-side `pytesseract`, especially on large
  scanned PDFs.
- **Certificate verification** no longer decodes real QR codes from an
  image (that needed OpenCV). It instead looks for a plain-text
  verification payload in the extracted text, of the form
  `AUTHVALIDATOR|cert_id=...|hash=...`.
- **No multi-user server** — every "user" only sees data stored in their
  own browser. There's no real backend enforcing access control.
