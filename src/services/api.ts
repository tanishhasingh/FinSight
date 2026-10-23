// src/services/api.ts
import axios from "axios";
import toast from "react-hot-toast";
import { 
  Expense, 
  User, 
  CategoryBudget, 
  SavingsGoal, 
  FinancialStats, 
  CategorySuggestion, 
  DetectedRecurring, 
  ForecastResult, 
  UnusualTransaction 
} from "../types";

const API_BASE_URL = "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const getAccessToken = () => localStorage.getItem("auth_token");
const getRefreshToken = () => localStorage.getItem("refresh_token");
const setAccessToken = (token: string) => localStorage.setItem("auth_token", token);

const clearAuth = () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_data");
};

// ✅ Attach JWT automatically
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Refresh expired access token
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 500 errors gracefully
    if (error.response?.status === 500) {
      console.warn("Server error 500:", error.config?.url);
      return Promise.resolve({
        data: [],
        status: 200,
        statusText: "OK (fallback)",
        headers: {},
        config: originalRequest,
      });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearAuth();
        toast.error("Session expired. Please log in again.");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = axios
            .post(`${API_BASE_URL}/token/refresh/`, { refresh: refreshToken })
            .then((res) => {
              const newAccess = res.data.access;
              setAccessToken(newAccess);
              api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
              return newAccess;
            })
            .finally(() => (isRefreshing = false));
        }

        const newAccessToken = await (refreshPromise as Promise<string>);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        clearAuth();
        toast.error("Session expired. Please log in again.");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// ✅ Transaction / Expense API
export const expenseApi = {
  async getExpenses(params?: {
    type?: string;
    category?: string;
    search?: string;
    ordering?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Expense[]> {
    try {
      const res = await api.get("/expenses/", { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error.response?.data || error.message);
      throw error;
    }
  },

  async createExpense(data: Omit<Expense, "id" | "userId" | "createdAt">): Promise<Expense> {
    try {
      const res = await api.post("/expenses/", data);
      toast.success(data.type === "income" ? "Income added!" : "Expense added!");
      return res.data.expense || res.data;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Failed to create transaction";
      toast.error(errorMsg);
      console.error("Failed to create transaction:", error.response?.data || error.message);
      throw error;
    }
  },

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    try {
      const res = await api.put(`/expenses/${id}/`, data);
      toast.success("Transaction updated!");
      return res.data.expense || res.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to update transaction";
      toast.error(errorMsg);
      throw error;
    }
  },

  async deleteExpense(id: string): Promise<void> {
    try {
      await api.delete(`/expenses/${id}/`);
      toast.success("Transaction deleted!");
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to delete transaction";
      toast.error(errorMsg);
      throw error;
    }
  },

  async getStats(): Promise<FinancialStats> {
    try {
      const res = await api.get("/expenses/stats/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch stats:", error.response?.data || error.message);
      throw error;
    }
  },

  async suggestCategory(title: string, description?: string, type?: string): Promise<CategorySuggestion> {
    try {
      const res = await api.get("/expenses/suggest_category/", {
        params: { title, description, type: type || "expense" },
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to get category suggestion:", error.response?.data || error.message);
      return {
        suggested_category: type === "income" ? "other_income" : "other",
        confidence: 0,
        confidence_label: "low",
        matched_keywords: [],
        is_ambiguous: false,
        explanation: "Suggestion unavailable.",
      };
    }
  },

  async getForecast(): Promise<ForecastResult> {
    try {
      const res = await api.get("/expenses/forecast/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch forecast:", error.response?.data || error.message);
      throw error;
    }
  },

  async getUnusualSpending(): Promise<{ flagged_count: number; unusual_transactions: UnusualTransaction[] }> {
    try {
      const res = await api.get("/expenses/unusual_spending/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch unusual spending:", error.response?.data || error.message);
      return { flagged_count: 0, unusual_transactions: [] };
    }
  },

  async importCSV(fileOrText: File | string): Promise<{ message: string; imported_count: number; skipped_count: number; errors: string[] }> {
    try {
      let res;
      if (typeof fileOrText === "string") {
        res = await api.post("/expenses/import_csv/", { csv_data: fileOrText });
      } else {
        const formData = new FormData();
        formData.append("file", fileOrText);
        res = await api.post("/expenses/import_csv/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(res.data.message || "CSV imported successfully!");
      return res.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to import CSV";
      toast.error(errorMsg);
      throw error;
    }
  },

  async exportCSV(): Promise<Blob> {
    try {
      const res = await api.get("/expenses/export_csv/", {
        responseType: "blob",
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to export CSV:", error.response?.data || error.message);
      throw error;
    }
  },

  async getExpensesGroupedByMonth(year?: number, month?: number): Promise<any> {
    try {
      const params: any = {};
      if (year) params.year = year;
      if (month) params.month = month;
      const res = await api.get("/expenses/monthly_grouped/", { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch grouped transactions:", error.response?.data || error.message);
      throw error;
    }
  },
};

// ✅ Category Budget API
export const budgetApi = {
  async getCategoryBudgets(): Promise<CategoryBudget[]> {
    try {
      const res = await api.get("/category-budgets/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch category budgets:", error.response?.data || error.message);
      return [];
    }
  },

  async getOverview(): Promise<{ category_budgets: CategoryBudget[]; alerts: any[]; alert_threshold: number }> {
    try {
      const res = await api.get("/category-budgets/overview/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch budget overview:", error.response?.data || error.message);
      return { category_budgets: [], alerts: [], alert_threshold: 80 };
    }
  },

  async createCategoryBudget(data: { category: string; limit: number }): Promise<CategoryBudget> {
    try {
      const res = await api.post("/category-budgets/", data);
      toast.success(`Budget for ${data.category} saved!`);
      return res.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.limit?.[0] || "Failed to save category budget";
      toast.error(errorMsg);
      throw error;
    }
  },

  async updateCategoryBudget(id: number, data: { limit: number }): Promise<CategoryBudget> {
    try {
      const res = await api.put(`/category-budgets/${id}/`, data);
      toast.success("Budget updated!");
      return res.data;
    } catch (error: any) {
      toast.error("Failed to update budget");
      throw error;
    }
  },

  async deleteCategoryBudget(id: number): Promise<void> {
    try {
      await api.delete(`/category-budgets/${id}/`);
      toast.success("Category budget removed");
    } catch (error: any) {
      toast.error("Failed to remove budget");
      throw error;
    }
  },
};

// ✅ Savings Goals API
export const savingsGoalApi = {
  async getGoals(): Promise<SavingsGoal[]> {
    try {
      const res = await api.get("/savings-goals/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch savings goals:", error.response?.data || error.message);
      return [];
    }
  },

  async createGoal(data: {
    title: string;
    target_amount: number;
    current_amount?: number;
    target_date?: string;
    category?: string;
  }): Promise<SavingsGoal> {
    try {
      const res = await api.post("/savings-goals/", data);
      toast.success("Savings goal created!");
      return res.data;
    } catch (error: any) {
      toast.error("Failed to create savings goal");
      throw error;
    }
  },

  async updateGoal(id: number, data: Partial<SavingsGoal>): Promise<SavingsGoal> {
    try {
      const res = await api.put(`/savings-goals/${id}/`, data);
      toast.success("Savings goal updated!");
      return res.data;
    } catch (error: any) {
      toast.error("Failed to update goal");
      throw error;
    }
  },

  async deleteGoal(id: number): Promise<void> {
    try {
      await api.delete(`/savings-goals/${id}/`);
      toast.success("Savings goal deleted!");
    } catch (error: any) {
      toast.error("Failed to delete goal");
      throw error;
    }
  },

  async deposit(id: number, amount: number): Promise<SavingsGoal> {
    try {
      const res = await api.post(`/savings-goals/${id}/deposit/`, { amount });
      toast.success(`Added ₹${amount.toLocaleString()} to goal!`);
      return res.data;
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to record deposit");
      throw error;
    }
  },

  async withdraw(id: number, amount: number): Promise<SavingsGoal> {
    try {
      const res = await api.post(`/savings-goals/${id}/withdraw/`, { amount });
      toast.success(`Withdrew ₹${amount.toLocaleString()} from goal!`);
      return res.data;
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to withdraw");
      throw error;
    }
  },
};

// ✅ Recurring Expenses API
export interface RecurringExpense {
  id?: string;
  title: string;
  amount: number;
  category: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  start_date: string;
  end_date?: string | null;
  next_date?: string;
  is_active?: boolean;
  description?: string;
}

export const recurringApi = {
  async getRecurringExpenses(): Promise<RecurringExpense[]> {
    try {
      const res = await api.get("/recurring/");
      return Array.isArray(res.data) ? res.data : [];
    } catch (error: any) {
      console.error("Failed to fetch recurring expenses:", error.response?.data || error.message);
      return [];
    }
  },

  async createRecurringExpense(data: RecurringExpense): Promise<RecurringExpense> {
    try {
      const res = await api.post("/recurring/", data);
      toast.success("Recurring payment scheduled!");
      return res.data;
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Failed to schedule recurring payment";
      toast.error(errorMsg);
      throw error;
    }
  },

  async updateRecurringExpense(id: string, data: Partial<RecurringExpense>): Promise<RecurringExpense> {
    try {
      const res = await api.put(`/recurring/${id}/`, data);
      toast.success("Recurring payment updated!");
      return res.data;
    } catch (error: any) {
      toast.error("Failed to update recurring payment");
      throw error;
    }
  },

  async deleteRecurringExpense(id: string): Promise<void> {
    try {
      await api.delete(`/recurring/${id}/`);
      toast.success("Recurring payment removed!");
    } catch (error: any) {
      toast.error("Failed to delete recurring payment");
      throw error;
    }
  },

  async toggleActive(id: string): Promise<RecurringExpense> {
    try {
      const res = await api.post(`/recurring/${id}/toggle_active/`);
      return res.data;
    } catch (error: any) {
      toast.error("Failed to toggle status");
      throw error;
    }
  },

  async generateRecurringExpenses(): Promise<{ generated_count: number }> {
    try {
      const res = await api.post("/recurring/generate_all_recurring_expenses/");
      toast.success(`Generated ${res.data.generated_count} recurring transactions!`);
      return res.data;
    } catch (error: any) {
      toast.error("Failed to generate recurring transactions");
      throw error;
    }
  },

  async detectRecurring(): Promise<{ detected_count: number; candidates: DetectedRecurring[] }> {
    try {
      const res = await api.get("/recurring/detect/");
      return res.data;
    } catch (error: any) {
      console.error("Failed to detect recurring payments:", error.response?.data || error.message);
      return { detected_count: 0, candidates: [] };
    }
  },

  async convertDetected(candidate: Partial<DetectedRecurring>): Promise<RecurringExpense> {
    try {
      const res = await api.post("/recurring/convert_detected/", {
        title: candidate.title,
        amount: candidate.average_amount,
        category: candidate.category,
        frequency: candidate.detected_frequency,
        start_date: candidate.last_payment_date,
        description: candidate.reason,
      });
      toast.success(`Converted '${candidate.title}' to recurring rule!`);
      return res.data;
    } catch (error: any) {
      toast.error("Failed to convert detected recurring payment");
      throw error;
    }
  },
};

// ✅ User Normalization Helper
export const normalizeUser = (data: any): User => {
  const u = data?.user || data || {};
  return {
    id: String(u.id || ''),
    username: u.username || '',
    email: u.email || '',
    firstName: u.firstName || u.first_name || '',
    lastName: u.lastName || u.last_name || '',
    currency: u.currency || 'INR',
    profilePicture: u.profilePicture || u.profile_picture || undefined,
    monthly_budget: u.monthly_budget !== undefined ? Number(u.monthly_budget) : 25000,
    alert_threshold: u.alert_threshold !== undefined ? Number(u.alert_threshold) : 80,
    enable_alerts: u.enable_alerts !== false,
  };
};

// ✅ User Profile & Settings API
export const userApi = {
  async getProfile(): Promise<User> {
    const res = await api.get("/profile/");
    const userData = normalizeUser(res.data);
    localStorage.setItem("user_data", JSON.stringify(userData));
    return userData;
  },

  async updateProfile(userData: Partial<User> | FormData): Promise<User> {
    const config =
      userData instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : {};
    const res = await api.put("/profile/", userData, config);
    const updated = normalizeUser(res.data);
    localStorage.setItem("user_data", JSON.stringify(updated));
    return updated;
  },

  async verifyEmail(token: string): Promise<any> {
    const res = await api.post("/verify-email/", { token });
    return res.data;
  },

  async resendVerification(email: string): Promise<any> {
    const res = await api.post("/resend-verification/", { email });
    return res.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post("/change-password/", {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: newPassword,
    });
    toast.success("Password changed!");
  },

  async getSettings(): Promise<any> {
    try {
      const res = await api.get("/budget/");
      const settings = res.data;
      localStorage.setItem("user_settings", JSON.stringify(settings));
      return settings;
    } catch (error: any) {
      console.error("Failed to fetch settings:", error.response?.data || error.message);
      return {
        monthly_budget: 25000,
        alert_threshold: 80,
        enable_alerts: true,
        notifications_enabled: true,
      };
    }
  },

  async updateSettings(settingsData: any): Promise<any> {
    try {
      const res = await api.put("/budget/", settingsData);
      const updatedSettings = res.data;
      localStorage.setItem("user_settings", JSON.stringify(updatedSettings));
      toast.success("Settings updated!");
      return updatedSettings;
    } catch (error: any) {
      console.error("Failed to update settings:", error.response?.data || error.message);
      toast.error("Failed to update settings");
      throw error;
    }
  },
};

// ✅ Reports API
export const reportsApi = {
  async getReports(startDate?: string, endDate?: string) {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get("/reports/", { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch reports:", error.response?.data || error.message);
      throw error;
    }
  },

  async getSpendingTrend(viewType: "monthly" | "yearly" = "monthly", months: number = 12) {
    try {
      const res = await api.get("/reports/spending_trend/", {
        params: { view: viewType, months },
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch spending trend:", error.response?.data || error.message);
      throw error;
    }
  },

  async getCategorySummary(startDate?: string, endDate?: string) {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get("/reports/category_summary/", { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch category summary:", error.response?.data || error.message);
      throw error;
    }
  },
};

// ✅ Notifications API
export const notificationApi = {
  async getNotifications() {
    const res = await api.get("/notifications/");
    return res.data;
  },
  async markAsRead(notificationId: string) {
    await api.post("/notifications/", { notification_id: notificationId });
  },
};

export default api;
