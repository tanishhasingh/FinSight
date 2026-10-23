from rest_framework import serializers
from .models import Expense
from .models import RecurringExpense
from decimal import Decimal


class RecurringExpenseSerializer(serializers.ModelSerializer):
    """
    Serializer for RecurringExpense model
    """
    user = serializers.StringRelatedField(read_only=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    
    class Meta:
        model = RecurringExpense
        fields = [
            'id', 'user', 'title', 'amount', 'category', 'frequency',
            'start_date', 'end_date', 'next_date', 'is_active', 'description',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate_amount(self, value):
        """Validate that amount is positive"""
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

    def validate_title(self, value):
        """Validate title is not empty"""
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value.strip()

    def validate(self, data):
        """Validate start_date and end_date"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if end_date and start_date and end_date <= start_date:
            raise serializers.ValidationError("End date must be after start date.")
        
        return data

    def create(self, validated_data):
        """Create recurring expense and set next_date if not provided"""
        if 'next_date' not in validated_data:
            validated_data['next_date'] = validated_data['start_date']
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
from .models import Expense, RecurringExpense, CategoryBudget, SavingsGoal
from django.utils import timezone
from django.db.models import Sum


class CategoryBudgetSerializer(serializers.ModelSerializer):
    """
    Serializer for CategoryBudget model
    """
    user = serializers.StringRelatedField(read_only=True)
    limit = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    spent_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    percentage_used = serializers.SerializerMethodField()
    is_exceeded = serializers.SerializerMethodField()

    class Meta:
        model = CategoryBudget
        fields = [
            'id', 'user', 'category', 'limit', 'spent_amount',
            'remaining_amount', 'percentage_used', 'is_exceeded',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_spent_amount(self, obj):
        today = timezone.now().date()
        month_start = today.replace(day=1)
        spent = Expense.objects.filter(
            user=obj.user,
            type='expense',
            category=obj.category,
            date__gte=month_start,
            date__lte=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return float(spent)

    def get_remaining_amount(self, obj):
        spent = self.get_spent_amount(obj)
        limit = float(obj.limit)
        return max(0.0, limit - spent)

    def get_percentage_used(self, obj):
        spent = self.get_spent_amount(obj)
        limit = float(obj.limit)
        if limit <= 0:
            return 0.0
        return round((spent / limit) * 100, 1)

    def get_is_exceeded(self, obj):
        spent = self.get_spent_amount(obj)
        return spent > float(obj.limit)

    def validate_limit(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Limit must be greater than 0.")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        category = validated_data.get('category')
        limit = validated_data.get('limit')
        obj, created = CategoryBudget.objects.update_or_create(
            user=user,
            category=category,
            defaults={'limit': limit}
        )
        return obj


class SavingsGoalSerializer(serializers.ModelSerializer):
    """
    Serializer for SavingsGoal model
    """
    user = serializers.StringRelatedField(read_only=True)
    target_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    current_amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    remaining_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, coerce_to_string=False)
    progress_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True, coerce_to_string=False)

    class Meta:
        model = SavingsGoal
        fields = [
            'id', 'user', 'title', 'target_amount', 'current_amount',
            'remaining_amount', 'progress_percentage', 'target_date',
            'category', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'remaining_amount', 'progress_percentage', 'created_at', 'updated_at']

    def validate_target_amount(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Target amount must be greater than 0.")
        return value

    def validate_current_amount(self, value):
        if value < Decimal('0'):
            raise serializers.ValidationError("Current amount cannot be negative.")
        return value

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ExpenseSerializer(serializers.ModelSerializer):
    """
    Serializer for Expense / Transaction model
    """
    user = serializers.StringRelatedField(read_only=True)
    userId = serializers.SerializerMethodField()
    formatted_amount = serializers.ReadOnlyField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    
    class Meta:
        model = Expense
        fields = [
            'id', 'user', 'userId', 'title', 'amount', 'type', 'category', 'date',
            'description', 'formatted_amount', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'userId', 'created_at', 'updated_at']
    
    def get_userId(self, obj):
        """Return user ID as string to match frontend expectations"""
        return str(obj.user.id)

    def validate_amount(self, value):
        """
        Validate that amount is positive
        """
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

    def validate_title(self, value):
        """
        Validate title is not empty
        """
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value.strip()

    def create(self, validated_data):
        """
        Create expense and associate with current user
        """
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating expenses / transactions (simplified)
    """
    class Meta:
        model = Expense
        fields = ['title', 'amount', 'type', 'category', 'date', 'description']

    def validate_amount(self, value):
        """
        Validate that amount is positive
        """
        if value <= Decimal('0'):
            raise serializers.ValidationError("Amount must be greater than 0.")
        return value

    def validate_title(self, value):
        """
        Validate title is not empty
        """
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value.strip()

    def create(self, validated_data):
        """
        Create transaction and associate with current user
        """
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ExpenseStatsSerializer(serializers.Serializer):
    """
    Serializer for comprehensive financial and expense statistics.
    coerce_to_string=False is required on every DecimalField so DRF
    emits JSON numbers (e.g. 60.0) instead of strings ("60.00").
    Without it, JavaScript receives a string and .toFixed() throws
    "TypeError: x.toFixed is not a function".
    """
    total_expenses = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    total_income = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    net_cash_flow = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    savings_rate = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    total_count = serializers.IntegerField()
    today_expenses = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    this_week_expenses = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    this_month_expenses = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    this_month_income = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    this_month_net = serializers.DecimalField(max_digits=14, decimal_places=2, coerce_to_string=False)
    this_month_savings_rate = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    category_breakdown = serializers.DictField()
    income_category_breakdown = serializers.DictField()
    monthly_trend = serializers.ListField()
    recent_expenses = ExpenseSerializer(many=True, read_only=True)