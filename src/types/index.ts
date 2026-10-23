export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  currency: string;
  profilePicture?: string;
  monthly_budget?: number;
  alert_threshold?: number;
  enable_alerts?: boolean;
}

export type TransactionType = 'expense' | 'income';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  type?: TransactionType;
  category: string;
  date: string;
  description?: string;
  userId: string;
  createdAt?: string;
  formatted_amount?: string;
}

export interface CategoryBudget {
  id: number;
  category: string;
  limit: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
  is_exceeded: boolean;
  is_warning?: boolean;
  created_at?: string;
}

export interface SavingsGoal {
  id: number;
  title: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  progress_percentage: number;
  target_date?: string;
  category?: string;
  created_at?: string;
}

export interface CategorySuggestion {
  suggested_category: string;
  confidence: number;
  confidence_label: 'high' | 'medium' | 'low';
  matched_keywords: string[];
  is_ambiguous: boolean;
  explanation: string;
}

export interface DetectedRecurring {
  title: string;
  category: string;
  average_amount: number;
  detected_frequency: string;
  frequency_label: string;
  average_interval_days: number;
  occurrences: number;
  last_payment_date: string;
  estimated_next_date: string;
  confidence: 'high' | 'medium' | 'low';
  is_ambiguous: boolean;
  amount_variation_pct: number;
  already_registered: boolean;
  reason: string;
}

export interface ForecastResult {
  sufficient_history: boolean;
  forecast_amount: number;
  method: string;
  periods_used: string[];
  historical_monthly_data: Array<{
    period: string;
    year: number;
    month: number;
    amount: number;
  }>;
  disclaimer: string;
  message: string;
  backtest_evaluation?: {
    evaluated_period: string;
    predicted_amount: number;
    actual_amount: number;
    variance_amount: number;
    variance_percentage: number;
    accuracy_label: string;
  } | null;
}

export interface UnusualTransaction {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  status_label: string;
  explanation: string;
  category_average: number;
}

export interface FinancialStats {
  total_expenses: number;
  total_income: number;
  net_cash_flow: number;
  savings_rate: number;
  total_count: number;
  today_expenses: number;
  this_week_expenses: number;
  this_month_expenses: number;
  this_month_income: number;
  this_month_net: number;
  this_month_savings_rate: number;
  category_breakdown: Record<string, number>;
  income_category_breakdown?: Record<string, number>;
  monthly_trend: Array<{
    month: string;
    short_month: string;
    expenses: number;
    income: number;
    net: number;
  }>;
  recent_expenses: Expense[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}