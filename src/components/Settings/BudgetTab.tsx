import React, { useState, useEffect } from 'react';
import { userApi, budgetApi, savingsGoalApi } from '../../services/api';
import { CategoryBudget, SavingsGoal } from '../../types';
import { Save, AlertTriangle, Plus, Trash2, PiggyBank, Target, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '../../utils/currency';

const CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Entertainment',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Housing',
  'Education',
  'Travel',
  'Other'
];

const BudgetTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Overall budget state
  const [budgetData, setBudgetData] = useState<{
    monthlyBudget: string | number;
    alertThreshold: string | number;
    enableAlerts: boolean;
    currentMonthExpenses: number;
    currentMonthIncome: number;
    budgetRemaining: number;
    netCashFlow: number;
    savingsRate: number;
  }>({
    monthlyBudget: 25000,
    alertThreshold: 80,
    enableAlerts: true,
    currentMonthExpenses: 0,
    currentMonthIncome: 0,
    budgetRemaining: 0,
    netCashFlow: 0,
    savingsRate: 0,
  });

  // Category Budgets state
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [newCatBudget, setNewCatBudget] = useState({ category: 'Food', limit: '' });
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Savings Goals state
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
    category: 'General'
  });
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  useEffect(() => {
    loadAllBudgetData();
  }, []);

  const loadAllBudgetData = async () => {
    try {
      setIsInitialLoading(true);
      const [settings, catOverview, goals] = await Promise.all([
        userApi.getSettings(),
        budgetApi.getOverview(),
        savingsGoalApi.getGoals(),
      ]);

      const stats = settings.budget_stats || {};
      setBudgetData({
        monthlyBudget: Number(settings.monthly_budget || stats.monthly_budget || 25000),
        alertThreshold: Number(settings.alert_threshold || 80),
        enableAlerts: settings.enable_alerts !== false,
        currentMonthExpenses: Number(stats.current_month_expenses || 0),
        currentMonthIncome: Number(stats.current_month_income || 0),
        budgetRemaining: Number(stats.budget_remaining || 0),
        netCashFlow: Number(stats.net_cash_flow || 0),
        savingsRate: Number(stats.savings_rate || 0),
      });

      setCategoryBudgets(catOverview.category_budgets || []);
      setSavingsGoals(
  Array.isArray(goals)
    ? goals
    : Array.isArray((goals as any)?.results)
      ? (goals as any).results
      : Array.isArray((goals as any)?.data)
        ? (goals as any).data
        : Array.isArray((goals as any)?.goals)
          ? (goals as any).goals
          : []
);
    } catch (error) {
      console.error('Failed to load budget and savings data:', error);
      toast.error('Failed to load budget data');
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setBudgetData(prev => ({ ...prev, [name]: checked }));
    } else {
      // Retain the raw input string while the user types or clears the field
      setBudgetData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveOverallBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBudget = parseFloat(String(budgetData.monthlyBudget).trim());
    const parsedThreshold = parseFloat(String(budgetData.alertThreshold).trim());

    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      toast.error('Please enter a valid monthly budget limit greater than 0.');
      return;
    }

    if (isNaN(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 100) {
      toast.error('Warning threshold must be between 1% and 100%.');
      return;
    }

    setIsLoading(true);
    try {
      await userApi.updateSettings({
        monthly_budget: parsedBudget,
        alert_threshold: parsedThreshold,
        enable_alerts: budgetData.enableAlerts,
      });
      await loadAllBudgetData();
      toast.success('Budget settings saved successfully!');
    } catch (error) {
      console.error('Failed to update budget settings:', error);
      toast.error('Failed to save budget settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(newCatBudget.limit);
    if (!limit || limit <= 0) {
      toast.error('Please enter a valid budget limit');
      return;
    }

    try {
      await budgetApi.createCategoryBudget({
        category: newCatBudget.category.toLowerCase(),
        limit,
      });
      setNewCatBudget({ category: 'Food', limit: '' });
      setIsAddingCat(false);
      const overview = await budgetApi.getOverview();
      setCategoryBudgets(overview.category_budgets);
    } catch (error) {
      console.error('Error adding category budget:', error);
    }
  };

  const handleDeleteCategoryBudget = async (id: number) => {
    if (!window.confirm('Delete this category budget limit?')) return;
    try {
      await budgetApi.deleteCategoryBudget(id);
      setCategoryBudgets(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting category budget:', error);
    }
  };

  const handleAddSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newGoal.target_amount);
    const initial = parseFloat(newGoal.current_amount || '0');

    if (!newGoal.title.trim()) {
      toast.error('Please provide a goal title');
      return;
    }
    if (!target || target <= 0) {
      toast.error('Target amount must be greater than zero');
      return;
    }

    try {
      await savingsGoalApi.createGoal({
        title: newGoal.title.trim(),
        target_amount: target,
        current_amount: initial,
        target_date: newGoal.target_date || undefined,
        category: newGoal.category,
      });
      setNewGoal({ title: '', target_amount: '', current_amount: '', target_date: '', category: 'General' });
      setIsAddingGoal(false);
      const refreshedGoals = await savingsGoalApi.getGoals();
      setSavingsGoals(refreshedGoals);
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      await savingsGoalApi.deleteGoal(id);
      setSavingsGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoalId) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await savingsGoalApi.deposit(depositGoalId, amount);
      setDepositGoalId(null);
      setDepositAmount('');
      const refreshed = await savingsGoalApi.getGoals();
      setSavingsGoals(refreshed);
    } catch (error) {
      console.error('Deposit error:', error);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const currentBudgetNum = Number(budgetData.monthlyBudget) || 0;
  const currentThresholdNum = Number(budgetData.alertThreshold) || 80;
  const budgetPercentage = currentBudgetNum > 0
    ? (budgetData.currentMonthExpenses / currentBudgetNum) * 100
    : 0;
  const isOverBudget = budgetPercentage > 100;
  const isNearThreshold = budgetPercentage >= currentThresholdNum;

  return (
    <div className="space-y-8">
      {/* 1. Monthly Budget Overview & Settings */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Monthly Budget Settings</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure spending limits, alert thresholds, and monitor real-time monthly utilisation.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Current Month Budget Status</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Budget</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatIndianCurrency(currentBudgetNum)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatIndianCurrency(budgetData.currentMonthExpenses)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
            <p className={`text-xl font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600 dark:text-green-400'}`}>
              {formatIndianCurrency(budgetData.budgetRemaining)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Utilisation</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{budgetPercentage.toFixed(1)}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                isOverBudget ? 'bg-red-500' : isNearThreshold ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>0%</span>
            <span>Threshold: {budgetData.alertThreshold}%</span>
            <span>100%</span>
          </div>
        </div>

        {isOverBudget && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>Warning: You have exceeded your monthly budget by {formatIndianCurrency(Math.abs(budgetData.budgetRemaining))}!</span>
          </div>
        )}
        {isNearThreshold && !isOverBudget && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <span>Notice: You have reached {budgetPercentage.toFixed(1)}% of your monthly budget limit.</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveOverallBudget} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="monthlyBudget" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Monthly Budget Limit (₹)
            </label>
            <input
              type="number"
              id="monthlyBudget"
              name="monthlyBudget"
              value={budgetData.monthlyBudget}
              onChange={handleBudgetChange}
              min="1"
              step="100"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="alertThreshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Warning Threshold (%)
            </label>
            <input
              type="number"
              id="alertThreshold"
              name="alertThreshold"
              value={budgetData.alertThreshold}
              onChange={handleBudgetChange}
              min="1"
              max="100"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enableAlerts"
            name="enableAlerts"
            checked={budgetData.enableAlerts}
            onChange={handleBudgetChange}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="enableAlerts" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable proactive budget threshold warnings
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'Saving...' : 'Save Overall Budget'}</span>
          </button>
        </div>
      </form>

      {/* 2. Category-Based Spending Limits */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Category Spending Limits
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Set distinct monthly spending caps for individual categories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingCat(!isAddingCat)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingCat ? 'Cancel' : 'Add Category Limit'}</span>
          </button>
        </div>

        {isAddingCat && (
          <form onSubmit={handleAddCategoryBudget} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={newCatBudget.category}
                onChange={(e) => setNewCatBudget(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Monthly Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={newCatBudget.limit}
                onChange={(e) => setNewCatBudget(prev => ({ ...prev, limit: e.target.value }))}
                min="1"
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              Save Limit
            </button>
          </form>
        )}

        {categoryBudgets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500">
            No category spending limits configured yet. Click "Add Category Limit" to set one up!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBudgets.map(b => (
              <div key={b.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">{b.category}</span>
                    {b.is_exceeded && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded font-medium">
                        Exceeded
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteCategoryBudget(b.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Delete category budget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Spent: {formatIndianCurrency(Number(b.spent_amount))}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Limit: {formatIndianCurrency(b.limit)}</span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      b.is_exceeded ? 'bg-red-500' : (Number(b.percentage_used) >= 80 ? 'bg-amber-500' : 'bg-indigo-500')
                    }`}
                    style={{ width: `${Math.min(Number(b.percentage_used), 100)}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{Number(b.percentage_used).toFixed(1)}% utilised</span>
                  <span>Remaining: {formatIndianCurrency(Number(b.remaining_amount))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Savings Goals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-emerald-600" />
              Savings Targets & Goals
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track emergency funds, vacation funds, and long-term milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingGoal(!isAddingGoal)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingGoal ? 'Cancel' : 'New Goal'}</span>
          </button>
        </div>

        {isAddingGoal && (
          <form onSubmit={handleAddSavingsGoal} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Goal Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Fund"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Target Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_amount: e.target.value }))}
                  min="1"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Initial Saved (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newGoal.current_amount}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, current_amount: e.target.value }))}
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Target Date (Optional)</label>
                <input
                  type="date"
                  value={newGoal.target_date}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
              >
                Create Goal
              </button>
            </div>
          </form>
        )}

        {savingsGoals.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500">
            No savings goals set. Create one to start budgeting for your targets!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savingsGoals.map(g => (
              <div key={g.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{g.title}</h4>
                    {g.target_date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Target Date: {g.target_date}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setDepositGoalId(g.id);
                        setDepositAmount('');
                      }}
                      className="px-2.5 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded font-medium transition-colors"
                    >
                      + Deposit
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Saved: {formatIndianCurrency(g.current_amount)}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Target: {formatIndianCurrency(g.target_amount)}</span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(Number(g.progress_percentage) || 0, 100)}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{(Number(g.progress_percentage) || 0).toFixed(1)}% achieved</span>
                  <span>Remaining: {formatIndianCurrency(g.remaining_amount)}</span>
                </div>

                {depositGoalId === g.id && (
                  <form onSubmit={handleDepositSubmit} className="pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    <input
                      type="number"
                      placeholder="Add amount (₹)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="1"
                      required
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositGoalId(null)}
                      className="px-2 py-1.5 text-gray-500 text-xs"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetTab;