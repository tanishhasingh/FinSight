import React, { useState, useEffect } from 'react';
import { recurringApi, RecurringExpense } from '../services/api';
import { useExpenses } from '../context/ExpenseContext';
import { DetectedRecurring } from '../types';
import Layout from '../components/Layout/Layout';
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Calendar, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '../utils/currency';

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

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' }
];

const Recurring: React.FC = () => {
  const { refreshExpenses } = useExpenses();
  const [activeTab, setActiveTab] = useState<'rules' | 'detected'>('rules');

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedRecurring[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Add / Edit form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Entertainment',
    frequency: 'monthly' as const,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [rules, detected] = await Promise.all([
        recurringApi.getRecurringExpenses(),
        recurringApi.detectRecurring(),
      ]);
      setRecurringExpenses(Array.isArray(rules) ? rules : []);
      setDetectedCandidates(detected?.candidates || []);
    } catch (err) {
      console.error('Failed to fetch recurring data:', err);
      setError('Failed to load recurring payments data');
    } finally {
      setIsLoading(false);
    }
  };

  const runDetection = async () => {
    try {
      setIsDetecting(true);
      const res = await recurringApi.detectRecurring();
      setDetectedCandidates(res.candidates || []);
      toast.success(`Found ${res.detected_count} recurring payment patterns!`);
    } catch (err) {
      toast.error('Detection scan failed');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConvertDetected = async (candidate: DetectedRecurring) => {
    try {
      await recurringApi.convertDetected(candidate);
      await loadData();
      toast.success(`Converted "${candidate.title}" into recurring subscription!`);
    } catch (err) {
      console.error('Conversion error:', err);
    }
  };

  const handleGenerateExpenses = async () => {
    try {
      setIsGenerating(true);
      const res = await recurringApi.generateRecurringExpenses();
      await refreshExpenses();
      await loadData();
      toast.success(res.generated_count > 0 ? `Created ${res.generated_count} transactions!` : 'All subscriptions are up to date.');
    } catch (err) {
      toast.error('Failed to generate recurring transactions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleActive = async (id?: string) => {
    if (!id) return;
    try {
      await recurringApi.toggleActive(id);
      setRecurringExpenses(prev =>
        prev.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r)
      );
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (window.confirm('Delete this recurring payment schedule?')) {
      try {
        await recurringApi.deleteRecurringExpense(id);
        setRecurringExpenses(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        toast.error('Failed to delete recurring payment');
      }
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      if (editingRecurring && editingRecurring.id) {
        await recurringApi.updateRecurringExpense(editingRecurring.id, {
          title: formData.title.trim(),
          amount,
          category: formData.category.toLowerCase(),
          frequency: formData.frequency,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          description: formData.description.trim(),
        });
        setEditingRecurring(null);
      } else {
        await recurringApi.createRecurringExpense({
          title: formData.title.trim(),
          amount,
          category: formData.category.toLowerCase(),
          frequency: formData.frequency,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          next_date: formData.start_date,
          is_active: true,
          description: formData.description.trim(),
        });
      }

      setFormData({
        title: '',
        amount: '',
        category: 'Entertainment',
        frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        description: ''
      });
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      console.error('Save recurring error:', err);
    }
  };

  const getConfidenceBadge = (confidence: string, isAmbiguous: boolean) => {
    if (confidence === 'high') {
      return (
        <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
          High Confidence
        </span>
      );
    }
    if (confidence === 'medium') {
      return (
        <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
          Medium Confidence
        </span>
      );
    }
    return (
      <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
        Low / Ambiguous
      </span>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
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
              Recurring Payments & Subscriptions
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automate periodic expenses and let FinSight discover recurring subscriptions from your transaction patterns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateExpenses}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generating...' : 'Process Due Bills'}</span>
            </button>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setEditingRecurring(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Cancel' : 'New Rule'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 gap-4">
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Active Recurring Rules ({recurringExpenses.length})
          </button>
          <button
            onClick={() => setActiveTab('detected')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'detected'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>AI Pattern Detector ({detectedCandidates.length})</span>
          </button>
        </div>

        {/* Tab 1: Active Recurring Rules */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Add / Edit Form Modal or Box */}
            {showAddForm && (
              <form onSubmit={handleSubmitForm} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  {editingRecurring ? 'Edit Recurring Schedule' : 'Schedule New Recurring Payment'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Netflix Subscription"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 499"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white capitalize"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={(e: any) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      {FREQUENCIES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            )}

            {recurringExpenses.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center text-gray-500 space-y-2">
                <Clock className="w-10 h-10 text-gray-400 mx-auto" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">No recurring rules configured</p>
                <p className="text-xs">
                  Create a recurring rule or check the "AI Pattern Detector" tab to automatically discover subscriptions!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recurringExpenses.map(r => (
                  <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{r.title}</h4>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full capitalize">
                          {r.frequency} • {r.category}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatIndianCurrency(r.amount)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Next Due: <strong className="text-gray-700 dark:text-gray-200">{r.next_date || r.start_date}</strong></p>
                      {r.description && <p className="italic">Note: {r.description}</p>}
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                      <button
                        onClick={() => handleToggleActive(r.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                          r.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.is_active ? 'Active' : 'Paused'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRecurring(r);
                            setFormData({
                              title: r.title,
                              amount: r.amount.toString(),
                              category: r.category,
                              frequency: r.frequency,
                              start_date: r.start_date,
                              end_date: r.end_date || '',
                              description: r.description || ''
                            });
                            setShowAddForm(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Detected Recurring Subscriptions */}
        {activeTab === 'detected' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Algorithmic Subscription Detection</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Scans historical intervals and payment amounts to identify recurring subscriptions.
                  </p>
                </div>
              </div>
              <button
                onClick={runDetection}
                disabled={isDetecting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Scanning...' : 'Rescan History'}</span>
              </button>
            </div>

            {detectedCandidates.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center text-gray-500 space-y-2">
                <p className="font-semibold text-gray-700 dark:text-gray-300">No recurring patterns discovered yet</p>
                <p className="text-xs max-w-sm mx-auto">
                  FinSight requires at least 2 repeat payments with consistent amounts and intervals to flag a potential recurring rule.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detectedCandidates.map((candidate, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{candidate.title}</h4>
                        <p className="text-xs text-gray-500 capitalize">{candidate.category} • {candidate.frequency_label}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatIndianCurrency(candidate.average_amount)}
                        </span>
                        <div className="mt-0.5">
                          {getConfidenceBadge(candidate.confidence, candidate.is_ambiguous)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p>{candidate.reason}</p>
                      <div className="flex justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-600">
                        <span>Occurrences: {candidate.occurrences}</span>
                        <span>Estimated Next: {candidate.estimated_next_date}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      {candidate.already_registered ? (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Already tracked in Recurring Rules
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConvertDetected(candidate)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                        >
                          <span>Convert to Recurring Rule</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recurring;