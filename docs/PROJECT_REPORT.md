# FinSight — Project Engineering Report

**Project Title**: FinSight: Intelligent Personal Finance Manager  
**Course Context**: University Software Engineering / Full-Stack Project Delivery  
**Base Repository**: [Buildwith18/Expense_Tracker](https://github.com/Buildwith18/Expense_Tracker) (Apache License 2.0)  
**Deliverable Status**: Complete, Verified, and Production-Ready  

---

## 1. Executive Summary

This report documents the architectural audit, iterative enhancement, testing, and delivery of **FinSight — Intelligent Personal Finance Manager**. Developed as an engineering enhancement of an open-source codebase, FinSight transforms a baseline expense recorder into an automated financial assistant. Key accomplishments include implementing dual income/expense ledgers, derived cash flow and savings rate calculations, category-level budget ceilings, savings target trackers, a rule-based intelligent categorization engine, a recurring subscription pattern detector, a moving-average expense forecasting model, and a statistical Z-score anomaly detector. The system has been validated through 17 automated unit and API integration tests, zero frontend build errors, and automated demonstration data seeding.

---

## 2. Problem Statement & Motivation

University students and young professionals frequently struggle with budgeting and managing personal finances. Existing personal finance applications suffer from several critical shortcomings:
1. **One-Sided Tracking**: Many applications record only outgoing expenses, failing to model income inflows, net cash flow, or savings rates.
2. **High Friction Data Entry**: Requiring users to manually categorize every cup of coffee or grocery trip leads to tracking fatigue and abandonment.
3. **Hidden Subscription Leaks**: Modern recurring subscriptions (streaming, cloud storage, gym memberships) silently accumulate without proactive alerts.
4. **Lack of Forward Visibility**: Traditional apps look backward without providing reasonable forecasts of future expenditure.
5. **Rigid Setup Requirements**: Many open-source academic projects fail to run out of the box due to strict external database dependencies (e.g. mandatory local MySQL/PostgreSQL daemons) and outdated package specifications.

---

## 3. Project Objectives

1. **Architecture Preservation**: Retain the Django 4.2+ / React 18 / TypeScript architecture and maintain full compliance with the original Apache 2.0 open-source license.
2. **Zero-Configuration Local Execution**: Default to SQLite for immediate, zero-friction local execution while retaining multi-database compatibility.
3. **Comprehensive Financial Tracking**: Deliver complete CRUD operations for both Income and Expenses, computing net flow and savings metrics dynamically from stored data.
4. **Proactive Financial Discipline**: Introduce category spending limits with configurable threshold warnings and savings goal trackers.
5. **Embedded Algorithmic Intelligence**: Implement explainable, transparent algorithms for auto-categorization, subscription detection, expense forecasting, and anomaly detection.
6. **Academic Rigor & Testing**: Back all core logic with automated test coverage and comprehensive technical documentation.

---

## 4. Audit of Original Codebase & Identified Limitations

The initial audit of the candidate repository (`Buildwith18/Expense_Tracker`) revealed the following baseline state and technical blockers:

| Area | Baseline State in Original Repo | Identified Limitation / Blocker | Resolution in FinSight |
|---|---|---|---|
| **Database** | Required MySQL running on `localhost:3306` with hardcoded credentials | Immediate blocker on clean developer machines without a running MySQL daemon | Updated `settings.py` to default to `BASE_DIR / 'db.sqlite3'`; switches to MySQL/Postgres only if `DB_ENGINE` env is specified |
| **Transaction Types** | Expense-only model | Inability to track salary, freelance income, net cash flow, or savings rate | Added `type` choice field (`'expense'`, `'income'`) and expanded categories to 17 choices |
| **Financial Stats** | Simple sum of expenses | No net flow or savings rate; dashboard lacked complete picture | Upgraded stats serializer to calculate Income, Net Flow, and zero-division safe Savings Rate |
| **Budgets** | Single global monthly budget field on User model | No category-specific limits (e.g. limiting dining vs. groceries) | Created `CategoryBudget` model with utilization percentages and 80%/100% alert states |
| **Savings Goals** | None | Users had no mechanism to track targets (e.g. Emergency Fund) | Created `SavingsGoal` model with atomic deposit/withdraw API endpoints |
| **Intelligence** | None | Manual category selection required for every entry | Developed rule-based tokenizer and keyword suggestion engine with confidence scoring |
| **Subscriptions** | Manual creation only | No heuristic detection of existing recurring payments | Built pattern detection heuristic evaluating intervals and amount variances |
| **Forecasting** | None | No forward-looking predictive capability | Built 3-Month Simple Moving Average (SMA-3) engine with backtest evaluation |
| **Anomaly Detection** | None | Outliers and large unusual expenses went unnoticed | Implemented Category Z-Score anomaly detector ($Z \ge 1.9$) with plain-English reasons |
| **Test Coverage** | 0 test cases in repo | Inability to verify regression safety | Wrote 17 automated unit and API integration tests in `backend/expenses/tests.py` |

---

## 5. Engineering Contributions & Implemented Enhancements

### 5.1 Dual-Type Financial Ledger & Dynamic Dashboard
- **Backend**: Added `type = models.CharField(choices=[('expense', 'Expense'), ('income', 'Income')], default='expense')` to the `Expense` model.
- **Formulas**:
  - $\text{Net Cash Flow} = \sum \text{Income} - \sum \text{Expenses}$
  - $\text{Savings Rate} = \frac{\text{Net Cash Flow}}{\text{Total Income}} \times 100 \quad (\text{if Income} > 0 \text{ else } 0.0\%)$
- **Frontend Dashboard**: Re-architected `src/pages/Dashboard.tsx` with 4 executive stat cards, SMA-3 forecast card, unusual spending warning banner, category budget progress bars, and a dual-series Recharts monthly comparison chart.

### 5.2 Category Spending Limits & Savings Goals
- Created `CategoryBudget` model with composite unique constraint `('user', 'category')` and `/api/category-budgets/overview/` endpoint.
- Created `SavingsGoal` model supporting target amount, current amount, target date, and `/deposit/` and `/withdraw/` actions.
- Integrated category limit progress cards and savings goal trackers directly into the settings and dashboard views.

### 5.3 Embedded Intelligence Engine (`backend/expenses/intelligence.py`)
1. **Rule-Based Categorizer**:
   - Matches title and description tokens against curated merchant dictionaries across 11 expense and 6 income categories.
   - Calculates confidence scores ($0.10$ to $0.95$) and flags semantic ambiguity conservatively.
   - Connected to real-time suggestion pills on `/add-expense`.
2. **Recurring Payment Pattern Detector**:
   - Groups past transactions by normalized title.
   - Detects periodic day intervals ($7, 14, 30, 90, 365\text{ days}$) and evaluates amount variances.
   - Outputs candidates with confidence grades and allows one-click conversion to active recurring schedules.
3. **SMA-3 Expense Forecasting**:
   - Calculates 3-Month Simple Moving Average over complete past calendar months.
   - Implements backtesting variance ($V_{\%}$) against the most recent completed month.
   - Displays clear period transparency and non-guarantee consumer disclaimers.
4. **Z-Score Anomaly Detector**:
   - Evaluates category standard deviations and flags transactions where $Z \ge 1.9 \land x \ge 1.7\mu \land x \ge \text{₹}300$.
   - Strictly labels results as **"Unusual Spending"** (not fraudulent) with empirical explanations.

### 5.4 CSV Data Pipeline & Deduplication
- Implemented `/api/expenses/import_csv/` supporting multipart file uploads and raw CSV text.
- Added duplicate checking based on composite tuple `(user, title, amount, date, type)`.
- Implemented `/api/expenses/export_csv/` generating RFC 4180-compliant CSV files.

---

## 6. Summary of Modified & Created Files

Below is the complete file manifest detailing modified and newly authored code:

```
├── backend/
│   ├── expense_tracker/
│   │   └── settings.py                 # [MODIFIED] Switched default DB to SQLite; expanded INSTALLED_APPS
│   ├── accounts/
│   │   ├── models.py                   # [INHERITED] User model with monthly_budget & alert_threshold
│   │   └── views.py                    # [MODIFIED] BudgetManagementView filters by type='expense'; adds net flow
│   ├── expenses/
│   │   ├── models.py                   # [MODIFIED] Added type choice, expanded categories, CategoryBudget, SavingsGoal
│   │   ├── intelligence.py             # [NEW] FinSight Intelligence Engine (Rules, Recurring, SMA-3, Z-Score)
│   │   ├── serializers.py              # [MODIFIED] Added CategoryBudget, SavingsGoal, StatsSerializer with income/net flow
│   │   ├── views.py                    # [MODIFIED] Added CRUD for budgets & goals, forecast, anomaly, CSV endpoints
│   │   ├── urls.py                     # [MODIFIED] Registered new routers & API endpoints
│   │   ├── tests.py                    # [NEW] 17 automated unit and API integration tests
│   │   └── management/commands/
│   │       └── seed_demo_data.py       # [NEW] Automated demonstration data seeder (70 realistic records)
├── src/
│   ├── types/index.ts                  # [MODIFIED] Expanded TypeScript interfaces for budgets, goals, intelligence
│   ├── services/api.ts                 # [MODIFIED] Complete API client supporting all new endpoints
│   ├── components/
│   │   ├── Layout/Sidebar.tsx          # [MODIFIED] Branded to FinSight with clean navigation
│   │   ├── Charts/BarChart.tsx         # [MODIFIED] Upgraded to dual-series (Income vs Expenses)
│   │   └── Settings/BudgetTab.tsx      # [MODIFIED] Category budget limits and savings goal management
│   ├── pages/
│   │   ├── Dashboard.tsx               # [MODIFIED] Executive cards, forecast, anomalies, budget bars, dual charts
│   │   ├── AddExpense.tsx              # [MODIFIED] Income/Expense toggle and real-time category suggestion pill
│   │   ├── History.tsx                 # [MODIFIED] Type & category filters, search, sorting, CSV import/export
│   │   ├── Recurring.tsx               # [MODIFIED] Active rules tab + AI Pattern Detector tab with 1-click convert
│   │   └── Reports.tsx                 # [MODIFIED] Reports and spending analytics with expense filtering
│   └── index.html                      # [MODIFIED] Page title updated to FinSight
├── docs/
│   ├── ARCHITECTURE.md                 # [NEW] System architecture and component data flow
│   ├── ALGORITHMS.md                   # [NEW] Mathematical formulations, pseudocode, and examples
│   └── PROJECT_REPORT.md               # [NEW] Formal engineering project report
└── README.md                           # [MODIFIED] Comprehensive project overview, installation, and demo guide
```

---

## 7. Verification & Testing Results

Testing was conducted across unit, API integration, and frontend build levels.

### 7.1 Backend Test Execution
Execution Command:
```bash
python backend/manage.py test expenses
```
Output:
```
Found 17 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
.................
----------------------------------------------------------------------
Ran 17 tests in 4.340s

OK
Destroying test database for alias 'default'...
```

### 7.2 Frontend Compilation Verification
Execution Command:
```bash
npm run build
```
Output:
```
vite v5.4.8 building for production...
✓ 2486 modules transformed.
dist/index.html                   0.48 kB │ gzip:   0.34 kB
dist/assets/index-CYsuLEUv.css   58.03 kB │ gzip:   9.16 kB
dist/assets/index-DNKNzxc2.js   774.70 kB │ gzip: 219.95 kB
✓ built in 1.84s
```

### 7.3 Live Intelligence Verification against Seeded Data
Execution Command:
```bash
python backend/manage.py seed_demo_data --clear
```
Verified results:
- **Forecast**: Identified 3 complete past calendar months, generating a 3-month Simple Moving Average of ₹44,227.00.
- **Pattern Detector**: Detected 17 recurring candidate groups, identifying Netflix (₹649/mo) and Spotify (₹119/mo) with high confidence.
- **Anomaly Detector**: Flagged the single outlier transaction (`Apple Store - MacBook Screen Repair`, ₹28,500.00) as exceeding 2.5× the global transaction mean.

---

## 8. Conclusion & Future Scope

Through structured architectural enhancement, FinSight successfully addresses the limitations of the original open-source base repository. It delivers a robust, visually polished, and algorithmically intelligent personal finance manager that is easy to run and demonstrate.

### Recommended Future Work:
1. **Dynamic User Rule Customization**: Allowing users to define custom regex or merchant-to-category mappings via the UI.
2. **Receipt Image OCR**: Leveraging client-side Tesseract.js or server-side OCR to extract totals and dates directly from uploaded receipt images.
3. **Multi-Currency Support**: Incorporating live or cached exchange rate feeds for seamless multi-currency travelers.
