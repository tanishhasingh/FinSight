import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExpenses } from '../context/ExpenseContext';
import { expenseApi } from '../services/api';
import { CategorySuggestion, TransactionType } from '../types';
import Layout from '../components/Layout/Layout';
import { Plus, Sparkles, ArrowDownCircle, ArrowUpCircle, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
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
  'Other',
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Gift',
  'Other Income',
];

const AddExpense: React.FC = () => {
  const navigate = useNavigate();
  const { addExpense } = useExpenses();

  const [txType, setTxType] = useState<TransactionType>('expense');
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // When transaction type changes, update default category
  const handleTypeChange = (newType: TransactionType) => {
    setTxType(newType);
    setFormData(prev => ({
      ...prev,
      category: newType === 'income' ? 'Salary' : 'Food',
    }));
    setSuggestion(null);
  };

  const categories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Real-time intelligent category suggestion (debounced)
  useEffect(() => {
    const textToAnalyze = `${formData.title} ${formData.description}`.trim();
    if (textToAnalyze.length < 3) {
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSuggesting(true);
        const res = await expenseApi.suggestCategory(formData.title, formData.description, txType);
        if (res && res.confidence > 0.3) {
          setSuggestion(res);
        } else {
          setSuggestion(null);
        }
      } catch (err) {
        console.error('Categorisation suggestion error:', err);
      } finally {
        setIsSuggesting(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.title, formData.description, txType]);

  const applySuggestedCategory = () => {
    if (!suggestion) return;
    // Find matching category in the current category list
    const found = categories.find(
      c => c.toLowerCase() === suggestion.suggested_category.toLowerCase()
    );
    if (found) {
      setFormData(prev => ({ ...prev, category: found }));
      toast.success(`Category set to ${found}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!formData.title.trim() || !formData.amount || !formData.category) {
      setError('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      await addExpense({
        title: formData.title.trim(),
        amount,
        type: txType,
        category: formData.category.toLowerCase().replace(' ', '_'),
        date: formData.date,
        description: formData.description.trim(),
      });

      // Reset form
      setFormData({
        title: '',
        amount: '',
        category: txType === 'income' ? 'Salary' : 'Food',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      setSuggestion(null);
      navigate('/history');
    } catch (err) {
      setError('Failed to create transaction record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Add Transaction Record
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Record an expense or income entry. FinSight will automatically suggest categories based on merchant keywords.
          </p>
        </div>

        {/* Transaction Type Toggle Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              txType === 'expense'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Expense (Spend)</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              txType === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Income (Earnings)</span>
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Title / Description */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Description / Merchant Name *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder={txType === 'expense' ? "e.g. Swiggy, Uber ride, Netflix, Grocery store" : "e.g. Monthly salary, Freelance invoice, Dividend payout"}
              />
            </div>

            {/* Intelligent Suggestion Banner */}
            {suggestion && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                suggestion.is_ambiguous
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <div className="truncate">
                    <span className="font-semibold capitalize">
                      Suggested Category: {suggestion.suggested_category}
                    </span>{' '}
                    <span className="opacity-80">({suggestion.explanation})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applySuggestedCategory}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs whitespace-nowrap shadow-sm"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Amount and Category Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={handleChange}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Transaction Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Notes & Context (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="Additional details, tax invoice number, tags..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition-all disabled:opacity-50 ${
                  txType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? 'Saving...' : `Save ${txType === 'income' ? 'Income' : 'Expense'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AddExpense;