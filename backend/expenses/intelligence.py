"""
FinSight Intelligence Engine
Rule-based categorisation, recurring payment pattern detection,
simple moving-average expense forecasting, and unusual-spending anomaly detection.
"""

from decimal import Decimal
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from collections import defaultdict
import re
import math


# ==============================================================================
# 1. RULE-BASED INTELLIGENT CATEGORISATION ENGINE
# ==============================================================================

EXPENSE_KEYWORD_RULES = {
    'food': [
        'swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald',
        'burger', 'pizza', 'domino', 'subway', 'kfc', 'taco', 'bakery', 'dinner',
        'lunch', 'breakfast', 'tea', 'chai', 'bistro', 'diner', 'snack', 'barbeque',
        'haldiram', 'bbq', 'barista', 'costa coffee', 'biryani', 'pizza hut'
    ],
    'groceries': [
        'grocery', 'groceries', 'supermarket', 'walmart', 'target', 'whole foods',
        'costco', 'market', 'blinkit', 'zepto', 'instacart', 'bigbasket', 'provisions',
        'vegetables', 'fruits', 'dairy', 'milk', 'spencer', 'dmart', 'nature basket',
        'reliance fresh', 'more retail', 'trader joe'
    ],
    'transport': [
        'uber', 'lyft', 'ola', 'taxi', 'cab', 'metro', 'subway', 'bus', 'train',
        'railway', 'irctc', 'gas', 'fuel', 'petrol', 'diesel', 'parking', 'toll',
        'shell', 'chevron', 'bp', 'hpcl', 'iocl', 'fastag', 'transit', 'commute',
        'auto', 'rickshaw', 'flight ticket', 'airline'
    ],
    'utilities': [
        'electricity', 'electric', 'power', 'water bill', 'water utility', 'internet',
        'wifi', 'broadband', 'phone bill', 'mobile recharge', 'airtel', 'jio', 'vi',
        'verizon', 'at&t', 'utility', 'gas bill', 'sewer', 'trash', 'cylinder',
        'indane', 'bharat gas', 'tatasky', 'dth'
    ],
    'entertainment': [
        'netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'hulu',
        'hotstar', 'cinema', 'theatre', 'theater', 'movie', 'steam', 'playstation',
        'xbox', 'concert', 'game', 'pvr', 'inox', 'bookmyshow', 'audible', 'youtube'
    ],
    'healthcare': [
        'pharmacy', 'medicine', 'hospital', 'doctor', 'clinic', 'dental', 'dentist',
        'chemist', 'apollo', 'cvs', 'walgreens', 'health', 'lab', 'diagnostics',
        'pathology', 'prescription', 'optician', 'physiotherapy', '1mg', 'pharmeasy'
    ],
    'shopping': [
        'amazon', 'flipkart', 'ebay', 'myntra', 'zara', 'h&m', 'clothing', 'apparel',
        'shoes', 'electronics', 'mall', 'retail', 'ajio', 'nykaa', 'nike', 'adidas',
        'uniqlo', 'gadget', 'furniture', 'ikea'
    ],
    'housing': [
        'rent', 'mortgage', 'maintenance', 'landlord', 'property tax', 'apartment',
        'home insurance', 'society maintenance', 'lease', 'flat maintenance'
    ],
    'education': [
        'tuition', 'course', 'udemy', 'coursera', 'books', 'college', 'university',
        'school', 'textbook', 'bootcamp', 'classes', 'exam fee', 'edx', 'skillshare',
        'stationery'
    ],
    'travel': [
        'flight', 'airline', 'hotel', 'airbnb', 'booking.com', 'expedia', 'makemytrip',
        'resort', 'vacation', 'trip', 'hostel', 'indigo', 'air india', 'goibibo',
        'agoda', 'visa fee', 'luggage'
    ],
}

INCOME_KEYWORD_RULES = {
    'salary': [
        'salary', 'payroll', 'stipend', 'wages', 'compensation', 'direct deposit',
        'monthly pay', 'employer', 'infosys', 'tcs', 'wipro', 'google', 'accenture'
    ],
    'freelance': [
        'upwork', 'fiverr', 'client payment', 'consulting', 'freelance', 'contract',
        'toptal', 'invoice payment', 'gig work', 'project payout'
    ],
    'investments': [
        'dividend', 'stocks', 'zerodha', 'groww', 'vanguard', 'fidelity', 'crypto',
        'interest', 'mutual fund', 'capital gain', 'robinhood', 'coinbase', 'etf'
    ],
    'business': [
        'customer payment', 'sales revenue', 'stripe', 'paypal payment', 'merchant payout',
        'razorpay payout', 'store revenue', 'pos credit'
    ],
    'gift': [
        'gift', 'cash gift', 'birthday', 'reward', 'cashback', 'reimbursement', 'allowance'
    ],
    'other_income': [
        'bonus', 'refund', 'tax refund', 'lottery', 'grant', 'settlement'
    ]
}


def suggest_category(title: str, description: str = '', tx_type: str = 'expense') -> dict:
    """
    Transparent rule-based categorization engine.
    Matches merchant keywords and description tokens.
    Handles ambiguous descriptions conservatively.
    """
    normalized_text = f"{title or ''} {description or ''}".lower()
    # Strip non-alphanumeric except spaces
    clean_text = re.sub(r'[^a-z0-9\s]', ' ', normalized_text)
    tokens = set(clean_text.split())

    rules = INCOME_KEYWORD_RULES if tx_type == 'income' else EXPENSE_KEYWORD_RULES
    matched_categories = defaultdict(list)

    for category, keywords in rules.items():
        for kw in keywords:
            # Check for multi-word keyword match in full clean text
            if ' ' in kw:
                if kw in clean_text:
                    matched_categories[category].append(kw)
            elif kw in tokens:
                matched_categories[category].append(kw)

    if not matched_categories:
        fallback = 'other_income' if tx_type == 'income' else 'other'
        return {
            'suggested_category': fallback,
            'confidence': 0.1,
            'confidence_label': 'low',
            'matched_keywords': [],
            'is_ambiguous': False,
            'explanation': 'No specific merchant or keyword rule matched. Conservative fallback applied.'
        }

    # Rank categories by number of matches and match length
    scores = {}
    for cat, kws in matched_categories.items():
        score = sum(len(kw.split()) * 1.0 + (0.5 if len(kw) > 5 else 0.2) for kw in kws)
        scores[cat] = (score, kws)

    sorted_scores = sorted(scores.items(), key=lambda item: item[1][0], reverse=True)
    top_category, (top_score, top_kws) = sorted_scores[0]

    # Check for ambiguity: if second best category has equal score
    is_ambiguous = False
    if len(sorted_scores) > 1:
        second_category, (second_score, _) = sorted_scores[1]
        if second_score >= top_score * 0.9 and top_category != second_category:
            is_ambiguous = True

    confidence = 0.95 if top_score >= 2.0 else (0.80 if top_score >= 1.0 else 0.60)
    if is_ambiguous:
        confidence = 0.45

    confidence_label = 'high' if confidence >= 0.8 else ('medium' if confidence >= 0.5 else 'low')

    return {
        'suggested_category': top_category,
        'confidence': round(confidence, 2),
        'confidence_label': confidence_label,
        'matched_keywords': top_kws,
        'is_ambiguous': is_ambiguous,
        'explanation': (
            f"Rule match: matched keywords [{', '.join(top_kws)}] for category '{top_category}'"
            + (" (Note: Multiple categories matched; verify suggested category)" if is_ambiguous else "")
        )
    }


# ==============================================================================
# 2. RECURRING PAYMENT PATTERN DETECTION
# ==============================================================================

def normalize_title(title: str) -> str:
    """Normalize transaction title to group similar recurring transactions."""
    t = title.lower()
    # Strip months, years, bill, payment, auto-generated, dates, numbers
    t = re.sub(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b', '', t)
    t = re.sub(r'\b(202\d|19\d\d)\b', '', t)
    t = re.sub(r'\(auto-generated\)', '', t)
    t = re.sub(r'[#\-_/\\:]', ' ', t)
    t = re.sub(r'\b(bill|payment|sub|subscription|fee|txn|ref)\b', '', t)
    t = re.sub(r'\d+', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t if len(t) >= 3 else title.lower().strip()


def detect_recurring_payments(user) -> list:
    """
    Identifies potential recurring payments using historical transaction amounts,
    descriptions, and temporal spacing. Avoids claiming certainty when ambiguous.
    """
    from .models import Expense, RecurringExpense

    # Pull user expenses ordered by date
    expenses = Expense.objects.filter(user=user, type='expense').order_by('date')
    if expenses.count() < 2:
        return []

    # Check already registered recurring rules so we can flag already tracked ones
    existing_titles = set(
        RecurringExpense.objects.filter(user=user).values_list('title', flat=True)
    )

    # Group expenses by normalized title
    groups = defaultdict(list)
    for exp in expenses:
        key = normalize_title(exp.title)
        groups[key].append(exp)

    detected = []

    for key, tx_list in groups.items():
        if len(tx_list) < 2:
            continue

        # Sort chronologically
        tx_list.sort(key=lambda x: x.date)

        # Calculate interval differences in days
        intervals = []
        for i in range(1, len(tx_list)):
            delta_days = (tx_list[i].date - tx_list[i - 1].date).days
            if delta_days > 0:
                intervals.append(delta_days)

        if not intervals:
            continue

        avg_interval = sum(intervals) / len(intervals)
        amounts = [float(tx.amount) for tx in tx_list]
        avg_amount = sum(amounts) / len(amounts)
        amount_variance = max(amounts) - min(amounts)
        amount_var_pct = (amount_variance / avg_amount) * 100 if avg_amount > 0 else 0

        # Classify frequency
        frequency = None
        freq_label = ''
        if 5 <= avg_interval <= 9:
            frequency = 'weekly'
            freq_label = 'Weekly (~7 days)'
            expected_days = 7
        elif 12 <= avg_interval <= 16:
            frequency = 'bi-weekly'
            freq_label = 'Bi-Weekly (~14 days)'
            expected_days = 14
        elif 25 <= avg_interval <= 35:
            frequency = 'monthly'
            freq_label = 'Monthly (~30 days)'
            expected_days = 30
        elif 80 <= avg_interval <= 100:
            frequency = 'quarterly'
            freq_label = 'Quarterly (~90 days)'
            expected_days = 90
        elif 350 <= avg_interval <= 380:
            frequency = 'yearly'
            freq_label = 'Yearly (~365 days)'
            expected_days = 365

        if not frequency:
            continue

        # Check interval consistency
        interval_diffs = [abs(i - expected_days) for i in intervals]
        max_interval_diff = max(interval_diffs)

        # Confidence assessment
        confidence = 'low'
        is_ambiguous = True

        if len(tx_list) >= 3 and amount_var_pct <= 5.0 and max_interval_diff <= 4:
            confidence = 'high'
            is_ambiguous = False
        elif len(tx_list) >= 2 and amount_var_pct <= 15.0 and max_interval_diff <= 7:
            confidence = 'medium'
            is_ambiguous = len(tx_list) == 2 or amount_var_pct > 8.0

        last_tx = tx_list[-1]
        next_date = last_tx.date + timedelta(days=int(round(avg_interval)))

        representative_title = tx_list[0].title
        # Strip trailing "(Auto-generated)" if present
        clean_rep_title = representative_title.replace('(Auto-generated)', '').strip()

        already_registered = any(
            normalize_title(clean_rep_title) == normalize_title(t)
            for t in existing_titles
        )

        detected.append({
            'title': clean_rep_title,
            'normalized_key': key,
            'category': last_tx.category,
            'average_amount': round(avg_amount, 2),
            'detected_frequency': frequency,
            'frequency_label': freq_label,
            'average_interval_days': round(avg_interval, 1),
            'occurrences': len(tx_list),
            'last_payment_date': last_tx.date.isoformat(),
            'estimated_next_date': next_date.isoformat(),
            'confidence': confidence,
            'is_ambiguous': is_ambiguous,
            'amount_variation_pct': round(amount_var_pct, 1),
            'already_registered': already_registered,
            'reason': (
                f"Observed {len(tx_list)} payments with average amount ₹{avg_amount:,.2f} "
                f"spaced approximately {round(avg_interval)} days apart "
                f"({confidence.capitalize()} confidence; amount variance {amount_var_pct:.1f}%)."
            )
        })

    # Sort high confidence first, then by occurrences
    order_map = {'high': 0, 'medium': 1, 'low': 2}
    detected.sort(key=lambda x: (order_map.get(x['confidence'], 3), -x['occurrences']))
    return detected


# ==============================================================================
# 3. EXPENSE FORECASTING ENGINE (Moving Average)
# ==============================================================================

def forecast_expenses(user) -> dict:
    """
    Simple moving-average forecast using historical monthly expenses.
    Displays forecast as an estimate, not a guarantee.
    Explains which historical periods were used.
    Handles insufficient history, missing months, and zero values.
    Provides backtesting evaluation against actual historical expenses.
    """
    from .models import Expense
    from django.db.models import Sum

    today = datetime.now().date()
    current_month_start = today.replace(day=1)

    # Fetch all expense transactions before current month
    past_expenses = Expense.objects.filter(
        user=user,
        type='expense',
        date__lt=current_month_start
    ).order_by('date')

    if not past_expenses.exists():
        # Check if there are any current month expenses to at least give a baseline
        cur_month_total = Expense.objects.filter(
            user=user,
            type='expense',
            date__gte=current_month_start
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return {
            'sufficient_history': False,
            'forecast_amount': float(cur_month_total) if cur_month_total > 0 else 0.0,
            'method': 'Baseline Current Month',
            'periods_used': [],
            'disclaimer': (
                "Estimated projection based on limited data; not a financial guarantee. "
                "At least 2 complete historical months are required for standard moving-average forecasting."
            ),
            'message': 'Insufficient historical data (less than 1 complete past month recorded).',
            'historical_monthly_data': [],
            'backtest_evaluation': None
        }

    # Group expenses into calendar months for the past 12 months
    monthly_totals = []
    # Find start month: up to 12 months back
    for i in range(12, 0, -1):
        m_start = (current_month_start - relativedelta(months=i))
        m_end = (m_start + relativedelta(months=1) - timedelta(days=1))
        
        # Check if user had transactions on or before this month to avoid padding ancient history
        first_tx = past_expenses.first()
        if first_tx and m_end < first_tx.date.replace(day=1):
            continue

        total = Expense.objects.filter(
            user=user,
            type='expense',
            date__gte=m_start,
            date__lte=m_end
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        monthly_totals.append({
            'period': m_start.strftime('%b %Y'),
            'year': m_start.year,
            'month': m_start.month,
            'amount': float(total)
        })

    if len(monthly_totals) < 2:
        # Only 1 month available
        amount = monthly_totals[0]['amount'] if monthly_totals else 0.0
        return {
            'sufficient_history': False,
            'forecast_amount': round(amount, 2),
            'method': 'Single-Month Baseline',
            'periods_used': [m['period'] for m in monthly_totals],
            'disclaimer': "Estimated projection; not a guarantee. 2+ full months required for SMA forecasting.",
            'message': 'Only 1 historical month available. Showing baseline estimate.',
            'historical_monthly_data': monthly_totals,
            'backtest_evaluation': None
        }

    # Use 3-month Simple Moving Average if 3+ months available, else 2-month
    window_size = min(3, len(monthly_totals))
    recent_periods = monthly_totals[-window_size:]
    recent_amounts = [p['amount'] for p in recent_periods]
    sma_forecast = sum(recent_amounts) / window_size

    # Backtest evaluation:
    # Use months before the last available month to predict the last available month,
    # and compare the prediction against actual to evaluate accuracy.
    backtest = None
    if len(monthly_totals) >= 3:
        backtest_window = monthly_totals[-(window_size + 1):-1]
        predicted_last_month = sum(p['amount'] for p in backtest_window) / len(backtest_window)
        actual_last_month = monthly_totals[-1]['amount']
        diff = actual_last_month - predicted_last_month
        diff_pct = (abs(diff) / actual_last_month * 100) if actual_last_month > 0 else 0.0

        backtest = {
            'evaluated_period': monthly_totals[-1]['period'],
            'predicted_amount': round(predicted_last_month, 2),
            'actual_amount': round(actual_last_month, 2),
            'variance_amount': round(diff, 2),
            'variance_percentage': round(diff_pct, 1),
            'accuracy_label': 'High Accuracy' if diff_pct <= 10 else ('Moderate Accuracy' if diff_pct <= 25 else 'High Variance')
        }

    periods_explained = [p['period'] for p in recent_periods]

    return {
        'sufficient_history': True,
        'forecast_amount': round(sma_forecast, 2),
        'method': f'{window_size}-Month Simple Moving Average (SMA-{window_size})',
        'periods_used': periods_explained,
        'historical_monthly_data': monthly_totals,
        'disclaimer': (
            "Forecast is an estimated projection based on past spending trends "
            f"({window_size}-month moving average) and should not be considered a financial guarantee."
        ),
        'message': f"Forecast for next month calculated using actual expenses from: {', '.join(periods_explained)}.",
        'backtest_evaluation': backtest
    }


# ==============================================================================
# 4. UNUSUAL-SPENDING ANOMALY DETECTION
# ==============================================================================

def detect_unusual_spending(user, lookback_days: int = 90) -> list:
    """
    Straightforward statistical method (Z-score + Category IQR) to detect unusual spending.
    Compares transactions against suitable historical category patterns.
    Explains why a transaction was flagged.
    Labels results as unusual, never as fraudulent.
    """
    from .models import Expense

    cutoff_date = datetime.now().date() - timedelta(days=lookback_days)
    all_expenses = Expense.objects.filter(user=user, type='expense').order_by('date')
    
    if all_expenses.count() < 4:
        return []

    # Calculate statistics per category
    cat_amounts = defaultdict(list)
    for exp in all_expenses:
        cat_amounts[exp.category].append(float(exp.amount))

    cat_stats = {}
    for cat, amounts in cat_amounts.items():
        if len(amounts) >= 3:
            mean = sum(amounts) / len(amounts)
            variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
            std_dev = math.sqrt(variance)
            cat_stats[cat] = {
                'mean': mean,
                'std_dev': std_dev,
                'count': len(amounts),
                'max': max(amounts)
            }

    # Global user baseline
    all_amounts = [float(e.amount) for e in all_expenses]
    global_mean = sum(all_amounts) / len(all_amounts)

    # Inspect recent expenses (within lookback_days)
    recent_expenses = all_expenses.filter(date__gte=cutoff_date)
    flagged = []

    for exp in recent_expenses:
        amount = float(exp.amount)
        cat = exp.category
        is_unusual = False
        reasons = []

        if cat in cat_stats:
            stats = cat_stats[cat]
            mean = stats['mean']
            std_dev = stats['std_dev']

            # Z-score test if standard deviation is meaningful (> 0)
            if std_dev > 0:
                z_score = (amount - mean) / std_dev
                # Flag if z_score >= 2.0 AND amount is at least 1.8x the category mean and > 300
                if z_score >= 1.9 and amount >= mean * 1.7 and amount >= 300:
                    is_unusual = True
                    reasons.append(
                        f"Amount (₹{amount:,.2f}) is {z_score:.1f} standard deviations above "
                        f"your typical {cat.capitalize()} spending average of ₹{mean:,.2f}."
                    )
            elif amount >= mean * 2.0 and amount >= 500:
                is_unusual = True
                reasons.append(
                    f"Amount (₹{amount:,.2f}) is double your recorded {cat.capitalize()} average of ₹{mean:,.2f}."
                )
        else:
            # Low category history: check against global user baseline
            if amount >= global_mean * 2.5 and amount >= 1000:
                is_unusual = True
                reasons.append(
                    f"Amount (₹{amount:,.2f}) is more than 2.5× your overall average transaction size (₹{global_mean:,.2f})."
                )

        if is_unusual:
            flagged.append({
                'id': exp.id,
                'title': exp.title,
                'amount': amount,
                'category': exp.category,
                'date': exp.date.isoformat(),
                'status_label': 'Unusual Spending',
                'explanation': " ".join(reasons),
                'category_average': round(cat_stats.get(cat, {}).get('mean', global_mean), 2)
            })

    # Sort highest amount first
    flagged.sort(key=lambda x: x['amount'], reverse=True)
    return flagged
