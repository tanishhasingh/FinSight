# 💰 FinSight — Intelligent Personal Finance Manager

**A full-stack personal finance web application for recording transactions, monitoring budgets, tracking savings goals, and understanding spending habits.**

FinSight extends an existing open-source expense-tracking project with additional financial-management features and a refreshed user experience. It was developed as a university software project to demonstrate frontend/backend integration, database-backed transactions, financial calculations, data visualisation, and testing.

> **Project status:** The application builds and the backend test suite passed during the latest local checks. The monthly budget editing issue and end-to-end email verification still need further work; see [Known Limitations](#known-limitations).

## ✨ Features

- **Financial dashboard** — view income, expenses, net cash flow, savings rate, and visual summaries.
- **Income and expense tracking** — record and review transactions with amounts, dates, categories, types, and descriptions.
- **Budget management** — configure budgets and monitor category spending with threshold warnings.
- **Savings goals** — set targets and track progress, including supported deposits and withdrawals.
- **Recurring expenses** — manage scheduled recurring payments and review bills that are due.
- **Transaction categorisation** — use rule-based merchant/keyword matching to suggest categories. This is rule-based categorisation, not a trained machine-learning model.
- **CSV import and export** — move transaction data using the format supported by the application, including duplicate detection during import.
- **Profile preferences** — manage supported account details and preferred currency display.
- **Appearance settings** — choose from available accent colours and display preferences, including dark/light and compact layouts where supported.

Feature availability can depend on configuration. See the limitations below before relying on account-verification or budget-editing behaviour.

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, Django, Django REST Framework |
| Database | SQLite for local development; database support depends on project configuration |
| Data visualisation | Frontend charts and dashboard summaries |
| Data exchange | CSV import/export |

## 📁 Project Structure

```text
FinSight/
├── backend/
│   ├── accounts/          # Account, authentication, and profile API
│   ├── expenses/          # Transactions and financial-management APIs
│   ├── expense_tracker/   # Django project configuration
│   └── manage.py          # Django management entry point
├── src/
│   ├── components/        # Reusable UI and settings components
│   ├── context/           # Shared application/authentication state
│   ├── pages/             # Main frontend pages
│   ├── services/          # API communication
│   ├── types/             # TypeScript types
│   └── utils/             # Shared helpers, including display preferences
├── package.json           # Frontend scripts and dependencies
├── .env.example           # Configuration template with placeholders only
├── .gitignore             # Excludes local data, secrets, and generated files
├── LICENSE                # Preserve the upstream project's license/notice
└── README.md
```

This tree shows the main source areas. Local secrets, virtual environments, `node_modules`, private uploads, and the local SQLite database should not be committed.

## 🚀 Getting Started

### Prerequisites

- Python and `pip`
- Node.js and npm
- Git (if cloning the repository)

Use the versions compatible with the dependency files in this repository.

### 1. Get the source code

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
cd FinSight-Intelligent-Personal-Finance-Manager
```

If running from a downloaded source folder instead of cloning, open a terminal in that folder and continue below.

### 2. Set up the backend

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies using the requirements file included in the repository. For example, if the file is `backend/requirements.txt`:

```bash
pip install -r backend/requirements.txt
```

If the requirements file is located elsewhere, use its actual path. Then apply database migrations and start Django:

```bash
python backend/manage.py migrate
python backend/manage.py runserver 8000
```

Keep this terminal open while using the app.

### 3. Set up the frontend

Open a second terminal in the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.

### 4. Configuration and email

Review `.env.example` and the backend settings before configuring a new environment. Copy the template to a local `.env` file if the application settings require it, and replace placeholders with your own development configuration. **Never commit `.env` or real secrets.**

Email verification is not yet confirmed as working end to end in the current submission. Local email-backend settings and real SMTP delivery may require additional configuration and testing. Do not enter real email passwords into source files.

## 🧪 Tests and Build Checks

From the project root, activate the virtual environment before running backend commands:

```bash
python backend/manage.py check
python backend/manage.py test accounts expenses
```

Build the frontend with:

```bash
npm run build
```

In the latest local verification before submission, the Django system check passed, the `accounts` and `expenses` test run passed **31 tests**, and the Vite production build completed. These automated checks do not replace testing the application manually in a browser.

## 📷 Screenshots

Add screenshots captured from the actual running application to a folder such as `docs/screenshots/`, then embed them here using relative paths. For example:

```markdown
![FinSight dashboard](docs/screenshots/dashboard.png)
```

Only include real screenshots from this project, and avoid showing passwords, private financial information, email addresses, or other sensitive details.

## ⚠️ Known Limitations

- **Monthly budget editing:** The budget input can still fail validation after clearing and re-entering a value. This issue remains unresolved in the current submission.
- **Email verification:** The end-to-end verification flow did not pass the latest manual check and should be considered incomplete. Real SMTP delivery has not been confirmed.
- **Currency preference:** Preferred currency formatting is a display preference unless exchange-rate conversion is explicitly implemented; it should not be assumed to convert stored amounts.
- **Development deployment:** Django's development server and local SQLite setup are for local demonstration/testing, not a production deployment configuration.

## 🔒 Repository and Data Safety

- Do not commit `.env`, credentials, API keys, passwords, or email app passwords.
- Do not commit a local database containing personal or demonstration account data.
- Keep virtual environments, dependency folders, generated bundles, caches, and private uploaded media out of version control.
- Use synthetic data for screenshots and demonstrations where possible.

## 📜 Credits and License

FinSight is an enhancement of the open-source **Buildwith18/Expense_Tracker** project. Retain the original project's `LICENSE` file and required notices/attribution when redistributing this work. Review the included license for the applicable terms.

## 🎓 Academic Project

**Project:** FinSight — Intelligent Personal Finance Manager  
**Purpose:** University software project demonstrating the enhancement and testing of an existing web application.

Add your course, class, academic year, and author details here if your submission requirements call for them. Avoid publishing personal contact details unnecessarily.
