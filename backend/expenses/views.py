import csv
import io
from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db import models
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from .models import Expense, RecurringExpense, CategoryBudget, SavingsGoal
from .serializers import (
    ExpenseSerializer, 
    ExpenseCreateSerializer, 
    ExpenseStatsSerializer,
    RecurringExpenseSerializer,
    CategoryBudgetSerializer,
    SavingsGoalSerializer
)
from .intelligence import (
    suggest_category,
    detect_recurring_payments,
    forecast_expenses,
    detect_unusual_spending
)
from rest_framework.pagination import PageNumberPagination


class NotificationsView(generics.GenericAPIView):
    """
    View for user notifications - returns empty list if notifications table doesn't exist
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get user notifications"""
        try:
            # Check if user has notifications attribute (table exists)
            if not hasattr(request.user, 'notifications'):
                return Response({
                    'notifications': [],
                    'unread_count': 0
                })
            
            notifications = request.user.notifications.all()[:10]  # Latest 10 notifications
            
            notification_data = []
            for notification in notifications:
                notification_data.append({
                    'id': notification.id,
                    'title': notification.title,
                    'message': notification.message,
                    'type': getattr(notification, 'type', 'info'),
                    'is_read': notification.is_read,
                    'created_at': notification.created_at.isoformat()
                })
            
            return Response({
                'notifications': notification_data,
                'unread_count': notifications.filter(is_read=False).count()
            })
        except Exception as e:
            # If table doesn't exist or any other error, return empty safely
            print(f"Notifications error: {e}")
            return Response({
                'notifications': [],
                'unread_count': 0
            })
    
    def post(self, request):
        """Mark notification as read"""
        try:
            if not hasattr(request.user, 'notifications'):
                return Response({'message': 'Notifications not configured'})
            
            notification_id = request.data.get('notification_id')
            notification = request.user.notifications.get(id=notification_id)
            notification.is_read = True
            notification.save()
            return Response({'message': 'Notification marked as read'})
        except Exception as e:
            return Response({'error': 'Notification not found'}, status=404)
class ReportsView(generics.GenericAPIView):
    """
    View for generating expense reports and analytics
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get comprehensive expense reports"""
        user = request.user
        all_tx = Expense.objects.filter(user=user)
        
        # Date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                all_tx = all_tx.filter(date__gte=start_date)
            except ValueError:
                return Response({
                    'error': 'Invalid start_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                all_tx = all_tx.filter(date__lte=end_date)
            except ValueError:
                return Response({
                    'error': 'Invalid end_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        expenses = all_tx.filter(type='expense')
        incomes = all_tx.filter(type='income')

        # Calculate statistics
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or 0
        total_income = incomes.aggregate(total=Sum('amount'))['total'] or 0
        net_savings = float(total_income) - float(total_expenses)
        total_count = expenses.count()
        
        # Daily average
        if expenses.exists():
            date_range = expenses.aggregate(
                min_date=models.Min('date'),
                max_date=models.Max('date')
            )
            if date_range['min_date'] and date_range['max_date']:
                days = (date_range['max_date'] - date_range['min_date']).days + 1
                daily_average = total_expenses / days if days > 0 else 0
            else:
                daily_average = 0
        else:
            daily_average = 0
        
        # Category breakdown
        category_breakdown = {}
        for choice in Expense.CATEGORY_CHOICES:
            category_total = expenses.filter(category=choice[0]).aggregate(
                total=Sum('amount')
            )['total'] or 0
            if category_total > 0:
                category_breakdown[choice[1]] = {
                    'amount': float(category_total),
                    'percentage': (float(category_total) / float(total_expenses)) * 100 if total_expenses > 0 else 0
                }
        
        # Top category
        top_category = None
        if category_breakdown:
            top_category = max(category_breakdown.items(), key=lambda x: x[1]['amount'])
            top_category = {
                'name': top_category[0],
                'amount': top_category[1]['amount']
            }
        
        # Monthly trend (last 6 months)
        monthly_trend = []
        today = timezone.now().date()
        for i in range(6):
            month_start = today.replace(day=1) - timedelta(days=i*30)
            month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            month_total = expenses.filter(
                date__gte=month_start,
                date__lte=month_end
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            monthly_trend.append({
                'month': month_start.strftime('%b %Y'),
                'amount': float(month_total)
            })
        
        monthly_trend.reverse()  # Show oldest to newest
        
        return Response({
            'total_expenses': float(total_expenses),
            'total_income': float(total_income),
            'net_savings': float(net_savings),
            'total_count': total_count,
            'daily_average': float(daily_average),
            'category_breakdown': category_breakdown,
            'top_category': top_category,
            'monthly_trend': monthly_trend,
            'date_range': {
                'start': start_date.isoformat() if start_date else None,
                'end': end_date.isoformat() if end_date else None
            }
        })

class SpendingTrendView(generics.GenericAPIView):
    """
    View for getting spending trend data for charts
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get spending trend data for charts"""
        user = request.user
        expenses = Expense.objects.filter(user=user, type='expense')
        
        # Get view type (monthly or yearly)
        view_type = request.query_params.get('view', 'monthly')
        months_back = int(request.query_params.get('months', 12))
        
        today = timezone.now().date()
        trend_data = []
        
        if view_type == 'monthly':
            # Monthly trend data
            for i in range(months_back):
                if i == 0:
                    month_start = today.replace(day=1)
                    month_end = today
                else:
                    month_start = (today.replace(day=1) - relativedelta(months=i))
                    month_end = (month_start + relativedelta(months=1) - timedelta(days=1))
                
                month_total = expenses.filter(
                    date__gte=month_start,
                    date__lte=month_end
                ).aggregate(total=Sum('amount'))['total'] or 0
                
                trend_data.append({
                    'period': month_start.strftime('%b %Y'),
                    'amount': float(month_total),
                    'date': month_start.isoformat()
                })
        
        elif view_type == 'yearly':
            # Yearly trend data
            years_back = max(1, months_back // 12)
            for i in range(years_back):
                year_start = today.replace(month=1, day=1) - relativedelta(years=i)
                year_end = year_start.replace(month=12, day=31)
                
                year_total = expenses.filter(
                    date__gte=year_start,
                    date__lte=year_end
                ).aggregate(total=Sum('amount'))['total'] or 0
                
                trend_data.append({
                    'period': year_start.strftime('%Y'),
                    'amount': float(year_total),
                    'date': year_start.isoformat()
                })
        
        trend_data.reverse()  # Show oldest to newest
        
        return Response({
            'trend_data': trend_data,
            'view_type': view_type,
            'total_periods': len(trend_data)
        })


class CategorySummaryView(generics.GenericAPIView):
    """
    View for getting category summary data for charts
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get category summary data for charts"""
        user = request.user
        expenses = Expense.objects.filter(user=user, type='expense')
        
        # Date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                expenses = expenses.filter(date__gte=start_date)
            except ValueError:
                return Response({
                    'error': 'Invalid start_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                expenses = expenses.filter(date__lte=end_date)
            except ValueError:
                return Response({
                    'error': 'Invalid end_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate category totals
        category_data = []
        total_amount = expenses.aggregate(total=Sum('amount'))['total'] or 0
        
        for choice in Expense.CATEGORY_CHOICES:
            category_total = expenses.filter(category=choice[0]).aggregate(
                total=Sum('amount')
            )['total'] or 0
            
            if category_total > 0:
                category_data.append({
                    'category': choice[1],
                    'amount': float(category_total),
                    'percentage': (float(category_total) / float(total_amount)) * 100 if total_amount > 0 else 0,
                    'count': expenses.filter(category=choice[0]).count()
                })
        
        # Sort by amount descending
        category_data.sort(key=lambda x: x['amount'], reverse=True)
        
        return Response({
            'category_data': category_data,
            'total_amount': float(total_amount),
            'total_categories': len(category_data)
        })


class RecurringExpenseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing recurring expenses
    """
    serializer_class = RecurringExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return recurring expenses for the current user only"""
        queryset = RecurringExpense.objects.filter(user=self.request.user).order_by('-created_at')
        print(f"📋 RecurringExpenseViewSet.get_queryset() - User: {self.request.user.email}, Count: {queryset.count()}")
        return queryset
    
    def list(self, request, *args, **kwargs):
        """List all recurring expenses for authenticated user"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print(f"📤 Returning {len(serializer.data)} recurring expenses for user {request.user.email}")
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Save recurring expense with current user"""
        # Set next_date to start_date if not provided
        if 'next_date' not in serializer.validated_data:
            serializer.validated_data['next_date'] = serializer.validated_data['start_date']
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Create a new recurring expense"""
        print(f"📝 Creating recurring expense for user: {request.user.email}")
        print(f"📝 Request data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Set next_date to start_date if not provided
        if 'next_date' not in serializer.validated_data:
            serializer.validated_data['next_date'] = serializer.validated_data['start_date']
        
        recurring_expense = serializer.save(user=request.user)
        
        # Return the serialized data directly (includes id, amount as number, etc.)
        response_data = RecurringExpenseSerializer(recurring_expense).data
        
        print(f"✅ Created recurring expense ID={recurring_expense.id}: {recurring_expense.title} for user {request.user.email}")
        print(f"✅ Response data: {response_data}")
        
        return Response(response_data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update a recurring expense"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Delete a recurring expense"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'message': 'Recurring expense deleted successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle active status of recurring expense"""
        recurring_expense = self.get_object()
        recurring_expense.is_active = not recurring_expense.is_active
        recurring_expense.save()
        
        # Return full serialized data to match frontend expectations
        return Response(RecurringExpenseSerializer(recurring_expense).data)

    @action(detail=False, methods=['post'])
    def generate_expenses(self, request):
        """Generate expenses from due recurring expenses"""
        today = timezone.now().date()
        due_recurring = self.get_queryset().filter(
            is_active=True,
            next_date__lte=today
        )
        
        generated_count = 0
        for recurring in due_recurring:
            # Check if we should stop generating (if end_date is set)
            if recurring.end_date and recurring.next_date > recurring.end_date:
                recurring.is_active = False
                recurring.save()
                continue
            
            # Create expense from recurring
            Expense.objects.create(
                user=recurring.user,
                title=f"{recurring.title} (Auto-generated)",
                amount=recurring.amount,
                category=recurring.category,
                date=recurring.next_date,
                description=f"Auto-generated from recurring expense: {recurring.description or ''}"
            )
            
            # Update next date
            recurring.next_date = recurring.calculate_next_date()
            recurring.save()
            generated_count += 1
        
        return Response({
            'message': f'Generated {generated_count} expenses from recurring expenses',
            'generated_count': generated_count
        })

    @action(detail=False, methods=['post'])
    def generate_all_recurring_expenses(self, request):
        """Generate all recurring expenses for the current month"""
        print(f"\n🔄 Generate all recurring expenses requested by user: {request.user.email}")
        
        today = timezone.now().date()
        current_month_start = today.replace(day=1)
        current_month_end = (current_month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        print(f"📅 Current month: {current_month_start} to {current_month_end}")
        
        active_recurring = self.get_queryset().filter(
            is_active=True,
            start_date__lte=current_month_end
        )
        
        print(f"📋 Found {active_recurring.count()} active recurring expenses")
        
        generated_count = 0
        generated_expenses = []
        
        for recurring in active_recurring:
            print(f"  Processing: {recurring.title} (next_date: {recurring.next_date})")
            # Generate expenses for each occurrence in the current month
            current_date = max(recurring.start_date, current_month_start)
            
            while current_date <= current_month_end:
                # Check if we should stop generating (if end_date is set)
                if recurring.end_date and current_date > recurring.end_date:
                    break
                
                # Check if this date matches the frequency
                if self._should_generate_on_date(recurring, current_date):
                    # Check if expense already exists for this date
                    existing_expense = Expense.objects.filter(
                        user=recurring.user,
                        title__contains=recurring.title,
                        date=current_date
                    ).exists()
                    
                    if not existing_expense:
                        new_expense = Expense.objects.create(
                            user=recurring.user,
                            title=f"{recurring.title} (Auto-generated)",
                            amount=recurring.amount,
                            category=recurring.category,
                            date=current_date,
                            description=f"Auto-generated from recurring expense: {recurring.description or ''}"
                        )
                        generated_count += 1
                        generated_expenses.append(new_expense.title)
                        print(f"    ✅ Generated expense: {new_expense.title} - ₹{new_expense.amount} on {current_date}")
                    else:
                        print(f"    ⏭️  Skipped (already exists): {recurring.title} on {current_date}")
                
                # Move to next occurrence
                current_date = self._get_next_occurrence_date(recurring, current_date)
        
        print(f"\n✅ Generation complete: {generated_count} expenses created")
        print(f"📝 Generated expenses: {generated_expenses}")
        
        return Response({
            'message': f'Generated {generated_count} recurring expenses for current month',
            'generated_count': generated_count,
            'generated_expenses': generated_expenses
        })

    def _should_generate_on_date(self, recurring, date):
        """Check if a recurring expense should generate on a specific date"""
        if recurring.frequency == 'daily':
            return True
        elif recurring.frequency == 'weekly':
            return date.weekday() == recurring.start_date.weekday()
        elif recurring.frequency == 'monthly':
            return date.day == recurring.start_date.day
        elif recurring.frequency == 'yearly':
            return date.month == recurring.start_date.month and date.day == recurring.start_date.day
        return False

    def _get_next_occurrence_date(self, recurring, current_date):
        """Get the next occurrence date for a recurring expense"""
        if recurring.frequency == 'daily':
            return current_date + timedelta(days=1)
        elif recurring.frequency == 'weekly':
            return current_date + timedelta(weeks=1)
        elif recurring.frequency == 'monthly':
            return current_date + relativedelta(months=1)
        elif recurring.frequency == 'yearly':
            return current_date + relativedelta(years=1)
        return current_date

    @action(detail=False, methods=['get'])
    def detect(self, request):
        """
        Detect potential recurring subscriptions and payments from transaction history
        """
        candidates = detect_recurring_payments(request.user)
        return Response({
            'detected_count': len(candidates),
            'candidates': candidates
        })

    @action(detail=False, methods=['post'])
    def convert_detected(self, request):
        """
        Convert a detected recurring candidate into an active recurring expense
        """
        data = request.data
        title = data.get('title')
        amount = data.get('amount')
        category = data.get('category', 'other')
        frequency = data.get('frequency', 'monthly')
        start_date = data.get('start_date') or timezone.now().date().isoformat()

        if not title or not amount:
            return Response({'error': 'Title and amount are required'}, status=status.HTTP_400_BAD_REQUEST)

        recurring = RecurringExpense.objects.create(
            user=request.user,
            title=title,
            amount=Decimal(str(amount)),
            category=category,
            frequency=frequency,
            start_date=start_date,
            next_date=start_date,
            is_active=True,
            description=data.get('description', 'Created from detected recurring pattern')
        )

        return Response(RecurringExpenseSerializer(recurring).data, status=status.HTTP_201_CREATED)


class CategoryBudgetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing category spending limits
    """
    serializer_class = CategoryBudgetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CategoryBudget.objects.filter(user=self.request.user).order_by('category')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """
        Get all category budgets with current spending, alerts, and threshold warnings
        """
        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        budgets = self.get_queryset()
        alert_threshold = getattr(user, 'alert_threshold', 80)
        
        results = []
        alerts = []
        
        for b in budgets:
            spent = Expense.objects.filter(
                user=user,
                type='expense',
                category=b.category,
                date__gte=month_start,
                date__lte=today
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            spent_float = float(spent)
            limit_float = float(b.limit)
            pct = round((spent_float / limit_float * 100), 1) if limit_float > 0 else 0
            remaining = max(0.0, limit_float - spent_float)
            is_exceeded = spent_float > limit_float
            is_warning = pct >= alert_threshold and not is_exceeded

            item = {
                'id': b.id,
                'category': b.category,
                'limit': limit_float,
                # Use the same field names as CategoryBudgetSerializer and the
                # frontend CategoryBudget TypeScript interface so the UI can
                # access b.spent_amount / b.remaining_amount / b.percentage_used
                # without them being undefined (the old 'spent' / 'remaining' /
                # 'percentage' keys caused b.percentage_used to be undefined and
                # b.percentage_used.toFixed() to throw a TypeError crash).
                'spent_amount': spent_float,
                'remaining_amount': remaining,
                'percentage_used': pct,
                'is_exceeded': is_exceeded,
                'is_warning': is_warning
            }
            results.append(item)

            if is_exceeded:
                alerts.append({
                    'category': b.category,
                    'type': 'danger',
                    'message': f"Category '{b.get_category_display()}' has exceeded budget limit (₹{spent_float:,.2f} spent of ₹{limit_float:,.2f} limit, {pct}%)."
                })
            elif is_warning:
                alerts.append({
                    'category': b.category,
                    'type': 'warning',
                    'message': f"Category '{b.get_category_display()}' has reached {pct}% of budget limit (threshold: {alert_threshold}%)."
                })

        return Response({
            'category_budgets': results,
            'alerts': alerts,
            'alert_threshold': alert_threshold
        })


class SavingsGoalViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing savings goals and tracking progress
    """
    serializer_class = SavingsGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavingsGoal.objects.filter(user=self.request.user).order_by('target_date', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        goal = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', 0)))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid deposit amount'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0'):
            return Response({'error': 'Deposit amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        goal.current_amount += amount
        goal.save()
        return Response(SavingsGoalSerializer(goal).data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        goal = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', 0)))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid withdrawal amount'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0'):
            return Response({'error': 'Withdrawal amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        if amount > goal.current_amount:
            return Response({'error': 'Cannot withdraw more than current saved balance'}, status=status.HTTP_400_BAD_REQUEST)

        goal.current_amount -= amount
        goal.save()
        return Response(SavingsGoalSerializer(goal).data)


class ExpensePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing transactions (both expenses and income)
    """
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ExpensePagination

    def get_queryset(self):
        """
        Return transactions for the current user with flexible filtering & sorting
        """
        queryset = Expense.objects.filter(user=self.request.user)

        # Filter by type ('expense' or 'income')
        tx_type = self.request.query_params.get('type')
        if tx_type in ['expense', 'income']:
            queryset = queryset.filter(type=tx_type)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category.lower())

        # Search in title or description
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        # Sorting
        ordering = self.request.query_params.get('ordering', '-date')
        allowed_ordering = ['date', '-date', 'amount', '-amount', 'title', '-title']
        if ordering in allowed_ordering:
            queryset = queryset.order_by(ordering, '-created_at')
        else:
            queryset = queryset.order_by('-date', '-created_at')

        return queryset

    def list(self, request, *args, **kwargs):
        """
        List all transactions for authenticated user
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action == 'create':
            return ExpenseCreateSerializer
        return ExpenseSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(user=request.user)
        response_serializer = ExpenseSerializer(expense)
        return Response({
            'message': 'Transaction created successfully',
            'expense': response_serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'message': 'Transaction updated successfully',
            'expense': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'message': 'Transaction deleted successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get comprehensive financial statistics:
        income, expenses, net cash flow, savings rate, and monthly trends
        """
        user = request.user
        all_txs = Expense.objects.filter(user=user)
        expenses_qs = all_txs.filter(type='expense')
        income_qs = all_txs.filter(type='income')

        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        # All-time totals
        total_expenses = expenses_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_income = income_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net_cash_flow = total_income - total_expenses
        savings_rate = (net_cash_flow / total_income * Decimal('100.0')) if total_income > Decimal('0') else Decimal('0.00')

        # Time-based expense totals (cap at today to exclude future-dated transactions)
        today_expenses = expenses_qs.filter(date=today).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        week_expenses = expenses_qs.filter(date__gte=week_start, date__lte=today).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        month_expenses = expenses_qs.filter(date__gte=month_start, date__lte=today).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Time-based income totals (cap at today to exclude future-dated transactions)
        month_income = income_qs.filter(date__gte=month_start, date__lte=today).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        month_net = month_income - month_expenses
        month_savings_rate = (month_net / month_income * Decimal('100.0')) if month_income > Decimal('0') else Decimal('0.00')

        # Category breakdowns
        category_breakdown = {}
        for choice in Expense.CATEGORY_CHOICES:
            cat_total = expenses_qs.filter(category=choice[0]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if cat_total > 0:
                category_breakdown[choice[1]] = float(cat_total)

        income_category_breakdown = {}
        for choice in Expense.CATEGORY_CHOICES:
            cat_total = income_qs.filter(category=choice[0]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if cat_total > 0:
                income_category_breakdown[choice[1]] = float(cat_total)

        # Monthly Income vs Expense comparison (past 6 calendar months, real data)
        monthly_trend = []
        for i in range(5, -1, -1):
            m_start = (month_start - relativedelta(months=i))
            m_end = (m_start + relativedelta(months=1) - timedelta(days=1))
            m_end_cap = min(m_end, today) if i == 0 else m_end
            m_exp = expenses_qs.filter(date__gte=m_start, date__lte=m_end_cap).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            m_inc = income_qs.filter(date__gte=m_start, date__lte=m_end_cap).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            monthly_trend.append({
                'month': m_start.strftime('%b %Y'),
                'short_month': m_start.strftime('%b'),
                'expenses': float(m_exp),
                'income': float(m_inc),
                'net': float(m_inc - m_exp)
            })

        recent_expenses = all_txs.order_by('-date', '-created_at')[:5]

        stats_data = {
            'total_expenses': round(total_expenses, 2),
            'total_income': round(total_income, 2),
            'net_cash_flow': round(net_cash_flow, 2),
            'savings_rate': round(savings_rate, 2),
            'total_count': all_txs.count(),
            'today_expenses': round(today_expenses, 2),
            'this_week_expenses': round(week_expenses, 2),
            'this_month_expenses': round(month_expenses, 2),
            'this_month_income': round(month_income, 2),
            'this_month_net': round(month_net, 2),
            'this_month_savings_rate': round(month_savings_rate, 2),
            'category_breakdown': category_breakdown,
            'income_category_breakdown': income_category_breakdown,
            'monthly_trend': monthly_trend,
            'recent_expenses': recent_expenses
        }

        serializer = ExpenseStatsSerializer(stats_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def suggest_category(self, request):
        """
        Suggest category using rule-based merchant keywords
        """
        title = request.query_params.get('title', '')
        description = request.query_params.get('description', '')
        tx_type = request.query_params.get('type', 'expense')
        result = suggest_category(title=title, description=description, tx_type=tx_type)
        return Response(result)

    @action(detail=False, methods=['get'])
    def forecast(self, request):
        """
        Generate 3-month moving average expense forecast
        """
        result = forecast_expenses(request.user)
        return Response(result)

    @action(detail=False, methods=['get'])
    def unusual_spending(self, request):
        """
        Detect unusual spending transactions using category Z-scores
        """
        result = detect_unusual_spending(request.user)
        return Response({
            'flagged_count': len(result),
            'unusual_transactions': result
        })

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """
        Import transactions from CSV with validation and duplicate prevention
        """
        csv_file = request.FILES.get('file')
        raw_csv_text = request.data.get('csv_data')

        if not csv_file and not raw_csv_text:
            return Response({'error': 'No CSV file or data provided'}, status=status.HTTP_400_BAD_REQUEST)

        if csv_file:
            try:
                decoded_file = csv_file.read().decode('utf-8-sig')
            except Exception as e:
                return Response({'error': f'Failed to decode file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            decoded_file = raw_csv_text

        import re
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        if not reader.fieldnames:
            return Response({'error': 'CSV is empty or missing headers'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize header keys to lowercase
        normalized_headers = {h.strip().lower(): h for h in reader.fieldnames if h}

        title_col = None
        amount_col = None
        date_col = None
        category_col = None
        type_col = None
        desc_col = None

        for key, original in normalized_headers.items():
            if 'title' in key or 'name' in key or key == 'description':
                if not title_col:
                    title_col = original
            if 'amount' in key or 'cost' in key or 'price' in key:
                amount_col = original
            if 'date' in key:
                date_col = original
            if 'category' in key:
                category_col = original
            if 'type' in key:
                type_col = original
            if 'desc' in key or 'note' in key or 'details' in key:
                desc_col = original

        if not title_col or not amount_col or not date_col:
            return Response({
                'error': f"CSV must contain 'Title', 'Amount', and 'Date' columns. Found: {list(reader.fieldnames)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        imported = 0
        skipped_duplicates = 0
        errors = []

        for row_idx, row in enumerate(reader, start=2):
            raw_title = (row.get(title_col) or '').strip()
            raw_amount = (row.get(amount_col) or '').strip()
            raw_date = (row.get(date_col) or '').strip()
            raw_cat = (row.get(category_col) or 'other').strip().lower() if category_col else 'other'
            raw_type = (row.get(type_col) or 'expense').strip().lower() if type_col else 'expense'
            raw_desc = (row.get(desc_col) or '').strip() if desc_col else ''

            if not raw_title or not raw_amount or not raw_date:
                errors.append(f"Row {row_idx}: Missing required field (title, amount, or date)")
                continue

            clean_amount = re.sub(r'[^\d.]', '', raw_amount)
            try:
                amount = Decimal(clean_amount)
                if amount <= Decimal('0'):
                    errors.append(f"Row {row_idx}: Amount must be positive ({raw_amount})")
                    continue
            except Exception:
                errors.append(f"Row {row_idx}: Invalid amount '{raw_amount}'")
                continue

            parsed_date = None
            date_formats = ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%b %d, %Y', '%B %d, %Y']
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(raw_date, fmt).date()
                    break
                except ValueError:
                    continue

            if not parsed_date:
                errors.append(f"Row {row_idx}: Invalid date format '{raw_date}'. Use YYYY-MM-DD or DD/MM/YYYY")
                continue

            tx_type = 'income' if raw_type in ['income', 'credit', 'deposit'] else 'expense'

            valid_categories = dict(Expense.CATEGORY_CHOICES).keys()
            if raw_cat not in valid_categories:
                suggestion = suggest_category(raw_title, raw_desc, tx_type)
                raw_cat = suggestion['suggested_category']

            exists = Expense.objects.filter(
                user=request.user,
                title__iexact=raw_title,
                amount=amount,
                date=parsed_date,
                type=tx_type
            ).exists()

            if exists:
                skipped_duplicates += 1
                continue

            Expense.objects.create(
                user=request.user,
                title=raw_title,
                amount=amount,
                type=tx_type,
                category=raw_cat,
                date=parsed_date,
                description=raw_desc
            )
            imported += 1

        return Response({
            'message': f"Import complete: {imported} imported, {skipped_duplicates} duplicate(s) skipped.",
            'imported_count': imported,
            'skipped_count': skipped_duplicates,
            'errors': errors
        }, status=status.HTTP_200_OK if imported > 0 or not errors else status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Export all user transactions to a CSV file
        """
        txs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="finsight_transactions_{timezone.now().date()}.csv"'

        writer = csv.writer(response)
        writer.writerow(['ID', 'Title', 'Amount', 'Type', 'Category', 'Date', 'Description'])

        for tx in txs:
            writer.writerow([
                tx.id,
                tx.title,
                float(tx.amount),
                tx.type,
                tx.get_category_display(),
                tx.date.isoformat(),
                tx.description or ''
            ])

        return response

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """
        Get expenses grouped by category
        """
        category = request.query_params.get('category')
        expenses = self.get_queryset().filter(type='expense')

        if category:
            expenses = expenses.filter(category=category)

        categories = {}
        for expense in expenses:
            cat_name = expense.get_category_display()
            if cat_name not in categories:
                categories[cat_name] = []
            categories[cat_name].append(ExpenseSerializer(expense).data)

        return Response(categories)

    @action(detail=False, methods=['get'])
    def by_date_range(self, request):
        """
        Get transactions within a date range
        """
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        expenses = self.get_queryset()

        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                expenses = expenses.filter(date__gte=start_date)
            except ValueError:
                return Response({
                    'error': 'Invalid start_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)

        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                expenses = expenses.filter(date__lte=end_date)
            except ValueError:
                return Response({
                    'error': 'Invalid end_date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(expenses, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def monthly_grouped(self, request):
        """
        Get transactions grouped by month and year
        """
        expenses = self.get_queryset()

        year = request.query_params.get('year')
        month = request.query_params.get('month')

        if year:
            try:
                year_int = int(year)
                expenses = expenses.filter(date__year=year_int)
            except ValueError:
                return Response({
                    'error': 'Invalid year format. Use YYYY'
                }, status=status.HTTP_400_BAD_REQUEST)

        if month:
            try:
                month_int = int(month)
                expenses = expenses.filter(date__month=month_int)
            except ValueError:
                return Response({
                    'error': 'Invalid month format. Use MM (1-12)'
                }, status=status.HTTP_400_BAD_REQUEST)

        from collections import defaultdict
        expenses_list = expenses.order_by('-date')
        grouped_expenses = defaultdict(lambda: {'expenses': [], 'total': 0, 'income': 0, 'expense': 0, 'count': 0})

        for expense in expenses_list:
            year_month = f"{expense.date.year}-{expense.date.month:02d}"
            grouped_expenses[year_month]['expenses'].append(ExpenseSerializer(expense).data)
            amt = float(expense.amount)
            if expense.type == 'income':
                grouped_expenses[year_month]['income'] += amt
            else:
                grouped_expenses[year_month]['expense'] += amt
                grouped_expenses[year_month]['total'] += amt
            grouped_expenses[year_month]['count'] += 1

        result = []
        for year_month, data in sorted(grouped_expenses.items(), key=lambda x: x[0], reverse=True):
            year, month = year_month.split('-')
            month_name = datetime(int(year), int(month), 1).strftime('%B')

            result.append({
                'year_month': year_month,
                'year': int(year),
                'month': int(month),
                'month_name': month_name,
                'expenses': data['expenses'],
                'total_amount': data['total'],
                'total_expense': data['expense'],
                'total_income': data['income'],
                'net_amount': data['income'] - data['expense'],
                'expense_count': data['count']
            })

        return Response({
            'grouped_expenses': result,
            'total_months': len(result)
        })