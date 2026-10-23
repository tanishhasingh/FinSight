import React, { useState, useEffect, useMemo, useRef } from 'react';
import { expenseApi } from '../services/api';
import { Expense, TransactionType } from '../types';
import Layout from '../components/Layout/Layout';
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Calendar, 
  RefreshCw, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '../utils/currency';

interface MonthlyGroup {
  year_month: string;
  year: number;
  month: number;
  month_name: string;
  expenses: Expense[];
  total_amount: number;
  total_expense?: number;
  total_income?: number;
  net_amount?: number;
  expense_count: number;
}

const ALL_CATEGORIES = [
  'All Categories',
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
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Gift',
  'Other Income',
  'Other'
];

const History: React.FC = () => {
  const [groupedExpenses, setGroupedExpenses] = useState<MonthlyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    type: 'expense' as TransactionType,
    category: '',
    date: '',
    description: ''
  });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  useEffect(() => {
    fetchGroupedExpenses();
  }, [selectedYear, selectedMonth]);

  const fetchGroupedExpenses = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await expenseApi.getExpensesGroupedByMonth(selectedYear, selectedMonth);
      setGroupedExpenses(data.grouped_expenses || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('Failed to fetch transaction history');
      toast.error('Failed to fetch transaction history');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (category: string, type?: string) => {
    if (type === 'income') {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    }
    const colors: Record<string, string> = {
      food: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
      groceries: 'bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300',
      transport: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
      entertainment: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
      utilities: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
      healthcare: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
      shopping: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300',
      housing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      education: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
      travel: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return colors[category.toLowerCase()] || colors.other;
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      type: expense.type || 'expense',
      category: expense.category,
      date: expense.date,
      description: expense.description || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    try {
      const amount = parseFloat(editFormData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      await expenseApi.updateExpense(editingExpense.id, {
        title: editFormData.title.trim(),
        amount,
        type: editFormData.type,
        category: editFormData.category.toLowerCase().replace(' ', '_'),
        date: editFormData.date,
        description: editFormData.description.trim(),
      });

      setEditingExpense(null);
      await fetchGroupedExpenses();
      toast.success('Transaction updated!');
    } catch (error) {
      toast.error('Failed to update transaction');
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (window.confirm(`Delete transaction "${expense.title}"?`)) {
      try {
        await expenseApi.deleteExpense(expense.id);
        await fetchGroupedExpenses();
      } catch (error) {
        toast.error('Failed to delete transaction');
      }
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    try {
      const allExpenses = groupedExpenses.flatMap(group => group.expenses);
      if (allExpenses.length === 0) {
        toast.error('No transactions available to export');
        return;
      }

      const csvContent = [
        ['ID', 'Title', 'Amount', 'Type', 'Category', 'Date', 'Description'],
        ...allExpenses.map(e => [
          e.id,
          `"${e.title.replace(/"/g, '""')}"`,
          e.amount.toString(),
          e.type || 'expense',
          e.category,
          e.date,
          `"${(e.description || '').replace(/"/g, '""')}"`
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finsight_transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Transactions exported to CSV!');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  // CSV Import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setIsImporting(true);
      const res = await expenseApi.importCSV(importFile);
      setImportResult(res);
      await fetchGroupedExpenses();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const clearFilters = () => {
    setSelectedYear(undefined);
    setSelectedMonth(undefined);
    setSearchTerm('');
    setSelectedType('all');
    setSelectedCategory('All Categories');
    setSortBy('date_desc');
  };

  // Filter and sort transactions
  const filteredGroups = useMemo(() => {
    return groupedExpenses.map(group => {
      let filtered = group.expenses.filter(tx => {
        // Type filter
        if (selectedType !== 'all' && (tx.type || 'expense') !== selectedType) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'All Categories' && tx.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }

        // Search term in title or description
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = tx.title.toLowerCase().includes(term);
          const matchDesc = (tx.description || '').toLowerCase().includes(term);
          if (!matchTitle && !matchDesc) return false;
        }

        return true;
      });

      // Sort
      filtered.sort((a, b) => {
        if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
        if (sortBy === 'amount_asc') return Number(a.amount) - Number(b.amount);
        return 0;
      });

      return {
        ...group,
        expenses: filtered,
      };
    }).filter(group => group.expenses.length > 0);
  }, [groupedExpenses, searchTerm, selectedType, selectedCategory, sortBy]);

  const totalFilteredCount = filteredGroups.reduce((sum, g) => sum + g.expenses.length, 0);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-gray-500">Loading transaction history...</p>
          </div>
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
              Transaction History
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Search, filter, edit, export, and import your financial income and expense records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchGroupedExpenses}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
              title="Refresh transactions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search description, merchant, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={selectedType}
                onChange={(e: any) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Types</option>
                <option value="expense">Expenses Only</option>
                <option value="income">Income Only</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="date_desc">Date (Newest First)</option>
                <option value="date_asc">Date (Oldest First)</option>
                <option value="amount_desc">Amount (Highest First)</option>
                <option value="amount_asc">Amount (Lowest First)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 gap-2 text-xs text-gray-500">
            <span>Showing {totalFilteredCount} matching transaction(s)</span>
            {(searchTerm || selectedType !== 'all' || selectedCategory !== 'All Categories' || selectedYear || selectedMonth) && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>

        {/* Transactions List Grouped by Month */}
        {filteredGroups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center space-y-3">
            <FileText className="w-12 h-12 text-gray-400 mx-auto" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No transactions found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              No matching records for your current filters. Add a new transaction or import from a CSV statement.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map(group => (
              <div key={group.year_month} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Month Group Header */}
                <div className="bg-gray-50/80 dark:bg-gray-700/50 px-6 py-3.5 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      {group.month_name} {group.year}
                    </span>
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {group.expenses.length} records
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {group.total_income !== undefined && (
                      <span className="text-emerald-600 font-medium">
                        Income: +{formatIndianCurrency(group.total_income)}
                      </span>
                    )}
                    {group.total_expense !== undefined && (
                      <span className="text-red-600 font-medium">
                        Expense: -{formatIndianCurrency(group.total_expense)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Transactions Table / List */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {group.expenses.map(tx => {
                    const isIncome = tx.type === 'income';
                    return (
                      <div key={tx.id} className="p-4 sm:px-6 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                            isIncome ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : 'bg-red-100 dark:bg-red-950/60 text-red-600'
                          }`}>
                            {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {tx.title}
                              </h4>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${getCategoryColor(tx.category, tx.type)}`}>
                                {tx.category}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {tx.date} {tx.description ? `• ${tx.description}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className={`font-bold text-base ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                              {isIncome ? '+' : '-'}{formatIndianCurrency(Number(tx.amount))}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(tx)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Edit transaction"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx)}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Delete transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Transaction Modal */}
        {editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Transaction</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={editFormData.type}
                      onChange={(e: any) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white capitalize"
                    >
                      {ALL_CATEGORIES.filter(c => c !== 'All Categories').map(cat => (
                        <option key={cat} value={cat.toLowerCase().replace(' ', '_')}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Import Transactions from CSV
                </h3>
                <button onClick={() => { setShowImportModal(false); setImportResult(null); }} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload a CSV bank or credit statement. FinSight validates amounts, dates, and automatically skips duplicates to prevent double-counting.
              </p>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-xs space-y-1 text-gray-600 dark:text-gray-300">
                <p className="font-semibold text-gray-800 dark:text-gray-200">Expected Column Headers:</p>
                <code className="block bg-gray-200 dark:bg-gray-900 px-2 py-1 rounded text-[11px]">
                  Title, Amount, Date, Category (optional), Type (optional), Description (optional)
                </code>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />

                {importResult && (
                  <div className={`p-3 rounded-lg text-xs space-y-1 ${
                    importResult.errors?.length > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    <p className="font-semibold">{importResult.message}</p>
                    {importResult.errors?.length > 0 && (
                      <p className="text-[11px] text-amber-700">Notice: {importResult.errors.slice(0, 3).join('; ')}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowImportModal(false); setImportResult(null); }}
                    className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || !importFile}
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                  >
                    {isImporting ? 'Importing...' : 'Upload & Process'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default History;