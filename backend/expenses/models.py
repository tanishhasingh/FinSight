from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import timedelta
from dateutil.relativedelta import relativedelta


class Expense(models.Model):
    """
    Transaction / Expense model for tracking user income and expenses
    """
    TYPE_CHOICES = [
        ('expense', 'Expense'),
        ('income', 'Income'),
    ]

    CATEGORY_CHOICES = [
        # Expense categories
        ('food', 'Food'),
        ('groceries', 'Groceries'),
        ('transport', 'Transport'),
        ('entertainment', 'Entertainment'),
        ('utilities', 'Utilities'),
        ('healthcare', 'Healthcare'),
        ('shopping', 'Shopping'),
        ('housing', 'Housing'),
        ('education', 'Education'),
        ('travel', 'Travel'),
        ('other', 'Other'),
        # Income categories
        ('salary', 'Salary'),
        ('freelance', 'Freelance'),
        ('investments', 'Investments'),
        ('business', 'Business'),
        ('gift', 'Gift'),
        ('other_income', 'Other Income'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='expenses',
        help_text='User who created this expense'
    )
    title = models.CharField(
        max_length=200,
        help_text='Brief description of the transaction'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Amount spent or earned'
    )
    type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default='expense',
        help_text='Transaction type: expense or income'
    )
    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        default='other',
        help_text='Category of the transaction'
    )
    date = models.DateField(
        help_text='Date when the transaction occurred'
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text='Additional details about the transaction (optional)'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When this transaction record was created'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='When this transaction record was last updated'
    )

    class Meta:
        db_table = 'expenses'
        verbose_name = 'Expense'
        verbose_name_plural = 'Expenses'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['user', 'type']),
            models.Index(fields=['user', 'category']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        sign = '+' if self.type == 'income' else '-'
        return f"{self.title} - {sign}₹{self.amount} ({self.user.username})"

    @property
    def formatted_amount(self):
        """Return formatted amount with Indian currency formatting."""
        return f"₹{self.amount:,.2f}"

    def save(self, *args, **kwargs):
        """Override save to ensure amount is positive."""
        if self.amount <= 0:
            raise ValueError("Amount must be greater than 0")
        super().save(*args, **kwargs)


class CategoryBudget(models.Model):
    """
    Category-based spending limits
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='category_budgets',
        help_text='User who configured this category budget'
    )
    category = models.CharField(
        max_length=30,
        choices=Expense.CATEGORY_CHOICES,
        help_text='Category for this spending limit'
    )
    limit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monthly limit amount'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'category_budgets'
        verbose_name = 'Category Budget'
        verbose_name_plural = 'Category Budgets'
        unique_together = ('user', 'category')
        ordering = ['category']

    def __str__(self):
        return f"{self.user.username} - {self.category}: ₹{self.limit}"


class SavingsGoal(models.Model):
    """
    Track savings targets and remaining amounts
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='savings_goals',
        help_text='User who set this savings goal'
    )
    title = models.CharField(
        max_length=200,
        help_text='Title of goal (e.g., Emergency Fund)'
    )
    target_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Target amount to save'
    )
    current_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Current amount saved towards goal'
    )
    target_date = models.DateField(
        null=True,
        blank=True,
        help_text='Target completion date'
    )
    category = models.CharField(
        max_length=50,
        default='General',
        help_text='Goal category or tag'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'savings_goals'
        verbose_name = 'Savings Goal'
        verbose_name_plural = 'Savings Goals'
        ordering = ['target_date', '-created_at']

    def __str__(self):
        return f"{self.title} - ₹{self.current_amount}/₹{self.target_amount} ({self.user.username})"

    @property
    def remaining_amount(self):
        """Amount remaining to achieve target"""
        rem = self.target_amount - self.current_amount
        return max(Decimal('0.00'), rem)

    @property
    def progress_percentage(self):
        """Percentage achieved towards target"""
        if self.target_amount <= Decimal('0'):
            return Decimal('0')
        pct = (self.current_amount / self.target_amount) * Decimal('100')
        return min(Decimal('100.00'), round(pct, 2))

class RecurringExpense(models.Model):
    """
    Model for recurring expenses (subscriptions, monthly bills, etc.)
    """

    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recurring_expenses',
        help_text='User who created this recurring expense'
    )
    title = models.CharField(
        max_length=200,
        help_text='Brief description of the recurring expense'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Amount for each occurrence'
    )
    category = models.CharField(
        max_length=50,
        choices=Expense.CATEGORY_CHOICES,
        default='other',
        help_text='Category of the recurring expense'
    )
    frequency = models.CharField(
        max_length=10,
        choices=FREQUENCY_CHOICES,
        default='monthly',
        help_text='How often this expense occurs'
    )
    start_date = models.DateField(
        help_text='When this recurring expense starts'
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text='When this recurring expense ends (optional)'
    )
    next_date = models.DateField(
        help_text='Next occurrence date'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this recurring expense is active'
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text='Additional details about the recurring expense'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recurring_expenses'
        verbose_name = 'Recurring Expense'
        verbose_name_plural = 'Recurring Expenses'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['next_date']),
        ]

    def __str__(self):
        return f"{self.title} - {self.frequency} - ₹{self.amount} ({self.user.username})"

    # ✅ Auto-calculate next occurrence date based on frequency
    def calculate_next_date(self):
        """Calculate the next occurrence date based on frequency."""
        if self.frequency == 'daily':
            return self.next_date + timedelta(days=1)
        elif self.frequency == 'weekly':
            return self.next_date + timedelta(weeks=1)
        elif self.frequency == 'monthly':
            return self.next_date + relativedelta(months=1)
        elif self.frequency == 'yearly':
            return self.next_date + relativedelta(years=1)
        return self.next_date


class Notification(models.Model):
    """
    Model for user notifications
    """
    TYPE_CHOICES = [
        ('budget_alert', 'Budget Alert'),
        ('expense_added', 'Expense Added'),
        ('recurring_generated', 'Recurring Expense Generated'),
        ('budget_exceeded', 'Budget Exceeded'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.user.username}"