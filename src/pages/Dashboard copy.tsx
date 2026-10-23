import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { expenseApi, budgetApi, savingsGoalApi } from '../services/api';
import { 
  FinancialStats, 
  ForecastResult, 
  UnusualTransaction, 
  CategoryBudget, 
  SavingsGoal 
} from '../types';
import Layout from '../components/Layout/Layout';
import StatCard from '../components/Cards/StatCard';
import ProgressBar from '../components/ProgressBar';
import CustomPieChart from '../components/Charts/PieChart';
import CustomBarChart from '../components/Charts/BarChart';
import { formatIndianCurrency } from '../utils/currency';
import { 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Calendar, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { expenses: contextExpenses, refreshExpenses } = useExpenses();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [unusualTxs, setUnusualTxs] = useState<UnusualTransaction[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [statsData, forecastData, unusualData, budgetOverview, goalsData] = await Promise.all([
        expenseApi.getStats().catch(() => null),
        expenseApi.getForecast().catch(() => null),
        expenseApi.getUnusualSpending().catch(() => ({ flagged_count: 0, unusual_transactions: [] })),
        budgetApi.getOverview().catch(() => ({ category_budgets: [], alerts: [], alert_threshold: 80 })),
        savingsGoalApi.getGoals().catch(() => []),
      ]);

      setStats(statsData);
      setForecast(forecastData);
      setUnusualTxs(unusualData?.unusual_transactions || []);
      setCategoryBudgets(budgetOverview?.category_budgets || []);
      setBudgetAlerts(budgetOverview?.alerts || []);
      setSavingsGoals(goalsData || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load real-time financial stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await refreshExpenses();
    await loadDashboardData();
  };

  // Derive current month totals directly from context/stats
  const thisMonthIncome = stats?.this_month_income ?? 0;
  const thisMonthExpenses = stats?.this_month_expenses ?? 0;
  const thisMonthNet = stats?.this_month_net ?? (thisMonthIncome - thisMonthExpenses);
  const thisMonthSavingsRate = stats?.this_month_savings_rate ?? (
    thisMonthIncome > 0 ? (thisMonthNet / thisMonthIncome) * 100 : 0
  );

  const monthlyBudget = user?.monthly_budget || 25000;
  const budgetPercentage = monthlyBudget > 0 ? (thisMonthExpenses / monthlyBudget) * 100 : 0;
  const budgetRemaining = Math.max(0, monthlyBudget - thisMonthExpenses);
  const isBudgetExceeded = thisMonthExpenses > monthlyBudget;

  // Pie chart data by category for expenses
  const pieChartData = useMemo(() => {
    if (!stats?.category_breakdown) return [];
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'
    ];
    return Object.entries(stats.category_breakdown).map(([name, value], idx) => ({
      name,
      value: Number(value) || 0,
      color: colors[idx % colors.length]
    }));
  }, [stats?.category_breakdown]);

  // Comparison trend data (real data from backend!)
  const comparisonTrendData = useMemo(() => {
    if (!stats?.monthly_trend || stats.monthly_trend.length === 0) return [];
    return stats.monthly_trend;
  }, [stats?.monthly_trend]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading your financial dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Financial Overview — {format(new Date(), 'MMMM yyyy')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time cash flow, category spending, algorithmic forecasting and budget alerts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              title="Refresh all metrics"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/add-expense"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Record</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* 1. Core Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatCard
            title="Total Income (This Month)"
            value={formatIndianCurrency(thisMonthIncome)}
            subtitle={`${stats?.total_income ? `Total All-Time: ${formatIndianCurrency(stats.total_income)}` : 'Recorded earnings'}`}
            icon={TrendingUp}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBgColor="bg-emerald-100 dark:bg-emerald-950/40"
          />
          <StatCard
            title="Total Expenses (This Month)"
            value={formatIndianCurrency(thisMonthExpenses)}
            subtitle={`${budgetPercentage.toFixed(1)}% of ₹${monthlyBudget.toLocaleString('en-IN')} budget`}
            icon={TrendingDown}
            iconColor="text-red-600 dark:text-red-400"
            iconBgColor="bg-red-100 dark:bg-red-950/40"
          />
          <StatCard
            title="Net Cash Flow"
            value={formatIndianCurrency(thisMonthNet)}
            subtitle={thisMonthNet >= 0 ? "Positive surplus" : "Deficit (Expenses > Income)"}
            icon={thisMonthNet >= 0 ? ArrowUpRight : ArrowDownRight}
            iconColor={thisMonthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
            iconBgColor={thisMonthNet >= 0 ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"}
          />
          <StatCard
            title="Savings Rate"
            value={`${thisMonthSavingsRate.toFixed(1)}%`}
            subtitle={thisMonthIncome > 0 ? "Proportion of income saved" : "No income recorded this month"}
            icon={PiggyBank}
            iconColor="text-indigo-600 dark:text-indigo-400"
            iconBgColor="bg-indigo-100 dark:bg-indigo-950/40"
          />
        </div>

        {/* 2. Intelligent Insights Row (Forecasting & Anomaly Detection) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Moving Average Forecast Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-none">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">Expense Forecast (Next Month)</h3>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    {forecast?.method || "3-Month Simple Moving Average"}
                  </p>
                </div>
              </div>
              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                Statistical Projection
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 dark:bg-gray-700/60 p-3.5 rounded-xl border border-indigo-50 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Expense</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {forecast ? formatIndianCurrency(forecast.forecast_amount) : "₹0.00"}
                </p>
              </div>
              <div className="bg-white/80 dark:bg-gray-700/60 p-3.5 rounded-xl border border-indigo-50 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Historical Base</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  {forecast?.periods_used?.length ? forecast.periods_used.join(', ') : 'Current baseline'}
                </p>
              </div>
              <div className="bg-white/80 dark:bg-gray-700/60 p-3.5 rounded-xl border border-indigo-50 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy Backtest</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  {forecast?.backtest_evaluation ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {forecast.backtest_evaluation.accuracy_label} ({forecast.backtest_evaluation.variance_percentage}% var)
                    </span>
                  ) : (
                    <span className="text-gray-400">Building historical base</span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-4">
              * {forecast?.disclaimer || "Projection based on past 3-month moving average trends. Not a financial guarantee."}
            </p>
          </div>

          {/* Unusual Spending Alert Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">Unusual Spending</h3>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  unusualTxs.length > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  {unusualTxs.length} Detected
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Statistical anomalies flagged when transactions exceed category norms (Z-score &gt; 1.9).
              </p>

              {unusualTxs.length === 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 text-center">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    No unusual spending detected. Spending is aligned with historical patterns!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {unusualTxs.slice(0, 3).map(tx => (
                    <div key={tx.id} className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-lg text-xs">
                      <div className="flex justify-between font-semibold text-gray-800 dark:text-gray-200">
                        <span>{tx.title}</span>
                        <span className="text-red-600">{formatIndianCurrency(tx.amount)}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-1 leading-snug">
                        {tx.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-right mt-3">
              <Link to="/history" className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                View all transactions →
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Monthly Budget Utilisation Progress */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Monthly Budget Progress</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Spent {formatIndianCurrency(thisMonthExpenses)} of {formatIndianCurrency(monthlyBudget)} limit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                isBudgetExceeded 
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' 
                  : (budgetPercentage >= 80 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300')
              }`}>
                {budgetPercentage.toFixed(1)}% Used
              </span>
              <Link to="/settings" className="text-xs font-medium text-blue-600 hover:underline">
                Adjust Limit
              </Link>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3.5">
            <div
              className={`h-3.5 rounded-full transition-all duration-500 ${
                isBudgetExceeded ? 'bg-red-500' : budgetPercentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Remaining: {formatIndianCurrency(budgetRemaining)}</span>
            <span>Monthly Target: {formatIndianCurrency(monthlyBudget)}</span>
          </div>

          {/* Category Budget Alerts if any */}
          {budgetAlerts.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Category Alerts:</p>
              {budgetAlerts.map((alert, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Charts Row: Real Monthly Income vs Expense Comparison & Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real Income vs Expenses Comparison Chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Monthly Income vs Expense Comparison
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Real monthly comparisons derived strictly from your stored transactions.
            </p>
            {comparisonTrendData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                No monthly transactions recorded yet.
              </div>
            ) : (
              <CustomBarChart data={comparisonTrendData} isComparison={true} />
            )}
          </div>

          {/* Category Breakdown Pie Chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Spending by Category
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Distribution of expenses across categories for {format(new Date(), 'MMMM yyyy')}.
            </p>
            {pieChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                No expense transactions recorded for this period.
              </div>
            ) : (
              <CustomPieChart data={pieChartData} title="" />
            )}
          </div>
        </div>

        {/* 5. Savings Goals Quick Progress Banner */}
        {savingsGoals.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Active Savings Targets
              </h3>
              <Link to="/settings" className="text-xs font-semibold text-blue-600 hover:underline">
                Manage Targets →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savingsGoals.slice(0, 3).map(g => (
                <div key={g.id} className="p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-gray-900 dark:text-white">{g.title}</span>
                    <span className="text-emerald-600 text-xs">{g.progress_percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(g.progress_percentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Saved: {formatIndianCurrency(g.current_amount)}</span>
                    <span>Goal: {formatIndianCurrency(g.target_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;