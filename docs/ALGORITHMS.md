# FinSight — Mathematical & Algorithmic Specifications

This document provides formal mathematical definitions, algorithmic pseudocode, operational assumptions, and concrete numerical examples for the four core algorithms comprising the **FinSight Intelligence Engine** (`backend/expenses/intelligence.py`) and financial ledger aggregators.

---

## Table of Contents

1. [Financial Metric Aggregations & Edge-Case Formulations](#1-financial-metric-aggregations--edge-case-formulations)
2. [Rule-Based Intelligent Categorisation Engine](#2-rule-based-intelligent-categorisation-engine)
3. [Recurring-Payment Pattern Detection Heuristic](#3-recurring-payment-pattern-detection-heuristic)
4. [3-Month Simple Moving Average (SMA-3) Expense Forecasting](#4-3-month-simple-moving-average-sma-3-expense-forecasting)
5. [Unusual-Spending Outlier Anomaly Detection](#5-unusual-spending-outlier-anomaly-detection)

---

## 1. Financial Metric Aggregations & Edge-Case Formulations

### 1.1 Net Cash Flow & Savings Rate
Given a user's transaction set $T$ over an arbitrary evaluation window (e.g. current calendar month), let:
- $I = \sum_{t \in T,\, t.\text{type} = \text{'income'}} t.\text{amount}$
- $E = \sum_{t \in T,\, t.\text{type} = \text{'expense'}} t.\text{amount}$

The **Net Cash Flow** ($\Delta$) is defined as:
$$\Delta = I - E$$

The **Savings Rate** ($S$) is defined as the percentage of earned income retained:
$$S = \begin{cases} 
\max\left(0.0,\, \frac{\Delta}{I} \times 100\right), & \text{if } I > 0 \\
0.0, & \text{if } I \le 0 
\end{cases}$$

#### Defensive Handling:
- When $I = 0$ and $E > 0$, naive calculation yields $\frac{-E}{0}$ (division by zero). FinSight guards this by returning $S = 0.0\%$.
- When $E > I$ (deficit spending), $\Delta < 0$. The rate is clamped to $0.0\%$ to reflect zero net savings.

### 1.2 Category Budget Utilization & Alert Triggers
For a category $c$ with spending limit $L_c > 0$ and recorded month-to-date expenses $E_c$:
$$\text{Utilization Percentage } P_c = \frac{E_c}{L_c} \times 100$$
$$\text{Remaining Allowance } R_c = \max(0.0,\, L_c - E_c)$$

#### Trigger State Machine:
- **Normal State**: $P_c < \theta$ (where $\theta$ is the user's configurable threshold, default $80\%$).
- **Warning State**: $\theta \le P_c \le 100\%$. Emits a warning notification: *"Category has reached $P_c\%$ of budget limit."*
- **Danger (Exceeded) State**: $P_c > 100\%$. Emits an alert notification: *"Category has exceeded budget limit by ₹$(E_c - L_c)$."*

---

## 2. Rule-Based Intelligent Categorisation Engine

### 2.1 Motivation
Manual classification is the primary point of user friction in expense management. Rather than introducing heavy, black-box ML models requiring GPU overhead and internet access, FinSight uses a transparent, deterministic rule engine.

### 2.2 Algorithm & Scoring Formulation
1. **Text Normalization**:
   The input title and description are concatenated, lowercased, and stripped of non-alphanumeric punctuation:
   $$\text{text}_{\text{clean}} = \text{regex\_replace}(\text{title} \mathbin{\Vert} \text{desc}, \text{"[^a-z0-9\s]"}, \text{" "})$$
   $$\text{Tokens } K = \text{tokenize}(\text{text}_{\text{clean}})$$

2. **Keyword Dictionary Matching**:
   Let $R_c = \{k_1, k_2, \dots, k_m\}$ be the curated keyword set for category $c \in C_{\text{type}}$.
   For each matched keyword $k \in R_c$ that appears as a full token or multi-word substring:
   $$\text{Weight}(k) = \text{word\_count}(k) \times 1.0 + \begin{cases} 0.5, & \text{if length}(k) > 5 \\ 0.2, & \text{otherwise} \end{cases}$$
   $$\text{Score}(c) = \sum_{k \in \text{Matched}(c)} \text{Weight}(k)$$

3. **Ambiguity & Confidence Estimation**:
   Sort categories such that $\text{Score}(c_{(1)}) \ge \text{Score}(c_{(2)}) \dots$
   - If $\text{Score}(c_{(1)}) = 0$: Return fallback category (`'other'` or `'other_income'`) with confidence $0.10$ (`low`).
   - If $\text{Score}(c_{(2)}) \ge 0.90 \times \text{Score}(c_{(1)})$ with $c_{(1)} \neq c_{(2)}$: Ambiguity is flagged; confidence is capped at $0.45$ (`low`/`medium`).
   - Otherwise, confidence is graded:
     $$\text{Confidence} = \begin{cases} 
     0.95 \text{ (high)}, & \text{if } \text{Score}(c_{(1)}) \ge 2.0 \\
     0.80 \text{ (high)}, & \text{if } \text{Score}(c_{(1)}) \ge 1.0 \\
     0.60 \text{ (medium)}, & \text{otherwise}
     \end{cases}$$

### 2.3 Concrete Example
- **Input**: `"Uber ride to campus"`
- **Tokens**: `{'uber', 'ride', 'to', 'campus'}`
- **Matches**:
  - `transport`: keyword `'uber'` (length 4 $\to$ weight 1.2), keyword `'ride'` (length 4 $\to$ weight 1.2). Total score: $2.4$.
- **Result**: Suggested category: `transport`, Confidence: $0.95$ (`high`), Ambiguity: `False`.

---

## 3. Recurring-Payment Pattern Detection Heuristic

### 3.1 Purpose
Detects ongoing subscriptions and recurring bills (e.g., Netflix, Spotify, Gym, Rent, Utility payments) from historical transactions without requiring manual setup.

### 3.2 Algorithm
```
Input: User's chronological expense transactions T
Output: List of detected recurring candidates

1. Group transactions by normalized title (strip trailing numbers, punctuation, spaces).
2. For each group with occurrences >= 2:
   a. Compute consecutive date deltas: Δd_i = date_{i} - date_{i-1} for i in 1..n-1.
   b. Compute average interval: μ_d = mean(Δd).
   c. Classify nominal frequency:
      - Weekly:     5 <= μ_d <= 9   (target: 7 days)
      - Bi-Weekly:  12 <= μ_d <= 16  (target: 14 days)
      - Monthly:    25 <= μ_d <= 35  (target: 30 days)
      - Quarterly:  80 <= μ_d <= 100 (target: 90 days)
      - Yearly:     350 <= μ_d <= 380 (target: 365 days)
      If μ_d does not fall in these windows, skip group.

   d. Compute amount variation:
      var_pct = ((max(amounts) - min(amounts)) / mean(amounts)) * 100
      max_interval_drift = max(|Δd_i - target_days|)

   e. Assign Confidence:
      - High:   occurrences >= 3 AND var_pct <= 5.0% AND max_interval_drift <= 4 days
      - Medium: occurrences >= 2 AND var_pct <= 15.0% AND max_interval_drift <= 7 days
      - Low:    otherwise (flagged as ambiguous)

   f. Estimate next occurrence date: next_date = last_date + round(μ_d) days.
```

---

## 4. 3-Month Simple Moving Average (SMA-3) Expense Forecasting

### 4.1 Model Formulation
Let $M_t$ denote the aggregate total expenses for complete historical calendar month $t$. The forecast for the upcoming month $\hat{M}_{t+1}$ using an $n$-period Simple Moving Average ($n = \min(3, \text{available\_months})$) is:

$$\hat{M}_{t+1} = \frac{1}{n} \sum_{i=0}^{n-1} M_{t-i}$$

### 4.2 Assumptions & Constraints
1. **Complete Calendar Month Boundary**:
   Incomplete current-month transactions are excluded from $M_t$ to prevent downward skewing of averages.
2. **Minimum History Requirement**:
   At least two complete historical months ($n \ge 2$) are required. If fewer than 2 months exist, FinSight returns a baseline status (`sufficient_history = False`) accompanied by an explanatory message.
3. **Non-Guarantee Disclosure**:
   In accordance with consumer financial reporting standards, all forecasts explicitly carry the disclaimer:
   > *"Forecast is an estimated projection based on past spending trends (3-month moving average) and should not be considered a financial guarantee."*

### 4.3 Backtesting & Accuracy Metric
To provide evaluative feedback on predictive reliability, FinSight evaluates the forecast against the most recent actual completed month ($M_t$):
$$\hat{M}_t = \frac{1}{n} \sum_{i=1}^{n} M_{t-i}$$
$$\text{Variance Amount } V = M_t - \hat{M}_t$$
$$\text{Variance Percentage } V_{\%} = \left|\frac{V}{M_t}\right| \times 100$$

- **Accuracy Labeling**:
  - $V_{\%} \le 10\%$: **High Accuracy**
  - $10\% < V_{\%} \le 25\%$: **Moderate Accuracy**
  - $V_{\%} > 25\%$: **High Variance**

---

## 5. Unusual-Spending Outlier Anomaly Detection

### 5.1 Formulation
FinSight detects anomalous expenditure using a **Category-Specific Z-Score Test** augmented with a proportional magnitude barrier.

For a transaction $x$ in category $c$ with category historical sample size $N_c \ge 3$:
$$\mu_c = \frac{1}{N_c} \sum_{i=1}^{N_c} x_i, \quad \sigma_c = \sqrt{\frac{1}{N_c} \sum_{i=1}^{N_c} (x_i - \mu_c)^2}$$
$$Z(x) = \frac{x - \mu_c}{\sigma_c}$$

### 5.2 Outlier Decision Rule
A transaction $x$ is flagged as **Unusual Spending** if and only if:
$$Z(x) \ge 1.9 \quad \land \quad x \ge 1.7 \times \mu_c \quad \land \quad x \ge \text{₹}300$$

Where:
- $Z(x) \ge 1.9$ corresponds approximately to the upper $2.87\%$ of a standard normal distribution.
- $x \ge 1.7 \times \mu_c$ ensures the transaction represents a meaningful practical increase beyond trivial standard deviations.
- $x \ge \text{₹}300$ eliminates false positives on minor low-cost spikes (e.g. ₹50 coffee vs ₹20 tea).

### 5.3 Global Baseline Fallback
If category history has fewer than 3 transactions ($N_c < 3$), the transaction is evaluated against the user's global mean across all categories ($\mu_{\text{global}}$):
$$\text{Flagged if } x \ge 2.5 \times \mu_{\text{global}} \quad \land \quad x \ge \text{₹}1,000$$

### 5.4 Ethical Labeling Directive
Results are labeled strictly as **"Unusual Spending"**, never as *"Fraud"* or *"Suspicious"*. The system outputs an empirical explanation:
> *"Amount (₹28,500.00) is 2.8 standard deviations above your typical Shopping spending average of ₹2,607.23."*
