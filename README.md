# 📬 MailScout Pro - Executive & HR Lead Finder & Verifier

A modern, high-deliverability B2B lead discovery and verification platform designed specifically for cold email campaigns. Enter any company name or domain to uncover key decision-makers (**Human Resources, Vice Presidents, Operational Directors, and C-Suite Executives**) with real-time multi-stage email deliverability verification.

---

## 🚀 Key Features

### 1. 🎯 Precision Role-Based Contact Discovery
- **Human Resources (HR)**: Talent Acquisition Managers, HR Directors, People Operations Leads, and direct team inboxes (`hr@`, `careers@`, `recruiting@`, `talent@`).
- **Vice Presidents (VP)**: VP of Engineering, VP of Sales, VP of Growth & Marketing, VP of Operations.
- **Directors**: Directors of Engineering, Operations, Business Development, and Management.
- **C-Suite & Founders**: CEO, Founders, Chief Officers.

### 2. 🛡️ Multi-Stage Email Legitimacy Verification ("Zero Bounce")
- **RFC 5322 Syntax Check**: Strict validation against international email format specifications.
- **Burner / Disposable Check**: Screens against a database of 500+ temporary email providers (e.g. Mailinator, TempMail).
- **DNS MX Record Resolution**: Verifies live mail exchange servers using `dnspython`.
- **Catch-All / Accept-All Detection**: Automatically identifies domains configured to accept any randomized recipient to prevent false deliverability positives.
- **Live SMTP Handshake Verification**: Connects to target mail exchange servers on port 25 and evaluates recipient validity (`250 OK` vs `550 User Unknown`).
- **Deliverability Confidence Score**: Calculates a transparent percentage score (0% - 100%) and actionable recommendation for cold outreach.

### 3. ⚡ High-Volume Batch / CSV Processing
- Built for users managing long company lists.
- Paste multiple company names/domains or upload a **CSV / TXT** file.
- Runs concurrent asynchronous pipeline with live progress tracking.
- Aggregate summary statistics (Total Companies, Total Leads, Deliverable Leads, HR count).
- One-click batch export to **CSV** or **Excel (.xlsx)**.

### 4. ✍️ One-Click Cold Outreach Assistant
- Built-in Cold Email Composer with proven, high-converting templates:
  - **Hiring & Career Pitch** (Tailored for HR & Recruiters)
  - **Executive Sales Solution** (Tailored for VPs)
  - **Operational Collaboration** (Tailored for Directors)
  - **Strategic Partnership** (Tailored for Founders & CEOs)
- Auto-populates recipient name, company, and role.
- One-click **"Open in Gmail"** (pre-fills recipient, subject, and body in Gmail web).
- One-click **"Copy Pitch"** or **"Default Mail Client (mailto)"**.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn (Asynchronous API)
- **Email & DNS Verification**: `dnspython`, `smtplib`, `socket`
- **Scraping & Data Extraction**: `httpx`, `BeautifulSoup4`
- **Data Export**: `pandas`, `openpyxl`
- **Frontend**: Responsive Tailwind CSS (Dark mode), Lucide Icons, Pure JavaScript (no heavy node dependencies required)

---

## 🏁 Quick Start Guide

### 1. Prerequisites
Ensure Python 3.10+ is installed.

### 2. Launch the Application
Run the launcher script:
```powershell
python run.py
```
This will automatically launch the local web server and open your default browser at:
👉 **`http://127.0.0.1:8000`**

Alternatively, you can run directly with Uvicorn:
```powershell
uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/autocomplete?q={query}` | Real-time company domain and logo autocomplete |
| `POST` | `/api/search` | Discover and verify HR, VP, Director contacts for a company |
| `POST` | `/api/verify-single` | Standalone multi-stage email deliverability verification |
| `POST` | `/api/batch-search` | Process up to 25 companies simultaneously |
| `POST` | `/api/upload-csv` | Parse uploaded CSV/TXT company list |
| `POST` | `/api/export` | Export contacts to CSV or Excel (`.xlsx`) |

---

## 🔒 Cold Outreach Compliance & Best Practices

- **Legitimacy Verification**: Always filter your exports by `Status = VALID` or Deliverability Score $\ge 80\%$ to keep your sender reputation healthy and bounce rate under 2%.
- **Compliance**: Follow CAN-SPAM, GDPR, and CASL guidelines by including relevant business propositions, clear identification, and an opt-out mechanism.

