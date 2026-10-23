from decimal import Decimal
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from expenses.models import Expense, CategoryBudget, SavingsGoal, RecurringExpense
from expenses.intelligence import (
    suggest_category,
    detect_recurring_payments,
    forecast_expenses,
    detect_unusual_spending
)

User = get_user_model()


class FinSightTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='student',
            email='student@example.com',
            password='TestPassword123',
            monthly_budget=Decimal('50000.00'),
            alert_threshold=80
        )
        self.client.force_authenticate(user=self.user)


class TransactionCRUDTests(FinSightTestCase):
    def test_create_expense_transaction(self):
        url = reverse('expense-list')
        data = {
            'title': 'Supermarket Groceries',
            'amount': 2500.50,
            'date': str(date.today()),
            'category': 'groceries',
            'type': 'expense',
            'description': 'Weekly household groceries'
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Expense.objects.count(), 1)
        tx = Expense.objects.first()
        self.assertEqual(tx.type, 'expense')
        self.assertEqual(tx.amount, Decimal('2500.50'))

    def test_create_income_transaction(self):
        url = reverse('expense-list')
        data = {
            'title': 'Monthly Salary',
            'amount': 65000.00,
            'date': str(date.today()),
            'category': 'salary',
            'type': 'income',
            'description': 'Software Engineer stipend'
        }
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx = Expense.objects.first()
        self.assertEqual(tx.type, 'income')
        self.assertEqual(tx.amount, Decimal('65000.00'))

    def test_update_and_delete_transaction(self):
        tx = Expense.objects.create(
            user=self.user,
            title='Dinner',
            amount=Decimal('450.00'),
            date=date.today(),
            category='food',
            type='expense'
        )
        # Update
        detail_url = reverse('expense-detail', kwargs={'pk': tx.id})
        res = self.client.put(detail_url, {
            'title': 'Dinner with Team',
            'amount': 550.00,
            'date': str(date.today()),
            'category': 'food',
            'type': 'expense'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tx.refresh_from_db()
        self.assertEqual(tx.title, 'Dinner with Team')
        self.assertEqual(tx.amount, Decimal('550.00'))

        # Delete
        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Expense.objects.count(), 0)

    def test_validation_invalid_amount(self):
        url = reverse('expense-list')
        # Negative amount
        res = self.client.post(url, {
            'title': 'Bad Expense',
            'amount': -100.00,
            'date': str(date.today()),
            'category': 'food',
            'type': 'expense'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class FinancialCalculationsTests(FinSightTestCase):
    def test_dashboard_calculations_and_savings_rate(self):
        today = date.today()
        # Create income and expenses
        Expense.objects.create(user=self.user, title='Salary', amount=Decimal('50000.00'), date=today, type='income', category='salary')
        Expense.objects.create(user=self.user, title='Rent', amount=Decimal('15000.00'), date=today, type='expense', category='housing')
        Expense.objects.create(user=self.user, title='Groceries', amount=Decimal('5000.00'), date=today, type='expense', category='groceries')

        res = self.client.get(reverse('expense-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Income: 50,000, Expenses: 20,000, Net Cash Flow: 30,000
        # Savings Rate: (30,000 / 50,000) * 100 = 60.0%
        self.assertEqual(float(data['total_income']), 50000.0)
        self.assertEqual(float(data['total_expenses']), 20000.0)
        self.assertEqual(float(data['net_cash_flow']), 30000.0)
        self.assertEqual(float(data['savings_rate']), 60.0)

    def test_zero_income_division_by_zero_handling(self):
        today = date.today()
        Expense.objects.create(user=self.user, title='Coffee', amount=Decimal('200.00'), date=today, type='expense', category='food')

        res = self.client.get(reverse('expense-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(float(data['total_income']), 0.0)
        self.assertEqual(float(data['total_expenses']), 200.0)
        self.assertEqual(float(data['net_cash_flow']), -200.0)
        self.assertEqual(float(data['savings_rate']), 0.0)  # Safe fallback without zero division error

    def test_empty_dataset_handling(self):
        res = self.client.get(reverse('expense-stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(float(data['total_income']), 0.0)
        self.assertEqual(float(data['total_expenses']), 0.0)
        self.assertEqual(float(data['net_cash_flow']), 0.0)
        self.assertEqual(float(data['savings_rate']), 0.0)


class CategoryBudgetTests(FinSightTestCase):
    def test_category_budget_limits_and_alerts(self):
        today = date.today()
        # Create category budget of 5000 for groceries
        CategoryBudget.objects.create(user=self.user, category='groceries', limit=Decimal('5000.00'))

        # Spend 4200 (84% -> above 80% threshold)
        Expense.objects.create(user=self.user, title='Grocery 1', amount=Decimal('4200.00'), date=today, type='expense', category='groceries')

        res = self.client.get(reverse('category_budget-overview'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        cb_list = res.data['category_budgets']
        alerts = res.data['alerts']

        self.assertEqual(len(cb_list), 1)
        self.assertEqual(cb_list[0]['spent_amount'], 4200.0)
        self.assertEqual(cb_list[0]['percentage_used'], 84.0)
        self.assertTrue(cb_list[0]['is_warning'])
        self.assertFalse(cb_list[0]['is_exceeded'])
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]['type'], 'warning')

        # Spend additional 1000 -> 5200 (104% -> exceeded)
        Expense.objects.create(user=self.user, title='Grocery 2', amount=Decimal('1000.00'), date=today, type='expense', category='groceries')
        res2 = self.client.get(reverse('category_budget-overview'))
        self.assertTrue(res2.data['category_budgets'][0]['is_exceeded'])
        self.assertEqual(res2.data['alerts'][0]['type'], 'danger')


class SavingsGoalTests(FinSightTestCase):
    def test_savings_goal_crud_and_deposits(self):
        target_date = date.today() + timedelta(days=90)
        goal = SavingsGoal.objects.create(
            user=self.user,
            title='Emergency Fund',
            target_amount=Decimal('10000.00'),
            current_amount=Decimal('2000.00'),
            target_date=target_date,
            category='emergency'
        )
        self.assertEqual(goal.remaining_amount, Decimal('8000.00'))
        self.assertEqual(goal.progress_percentage, 20.0)

        # Deposit
        dep_url = reverse('savings_goal-deposit', kwargs={'pk': goal.id})
        res = self.client.post(dep_url, {'amount': 3000.00})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        goal.refresh_from_db()
        self.assertEqual(goal.current_amount, Decimal('5000.00'))
        self.assertEqual(goal.progress_percentage, 50.0)

        # Withdraw
        with_url = reverse('savings_goal-withdraw', kwargs={'pk': goal.id})
        res2 = self.client.post(with_url, {'amount': 1000.00})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        goal.refresh_from_db()
        self.assertEqual(goal.current_amount, Decimal('4000.00'))

        # Withdraw more than balance -> reject
        bad_res = self.client.post(with_url, {'amount': 99999.00})
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)


class RuleBasedCategorizationTests(FinSightTestCase):
    def test_category_suggestions(self):
        test_cases = [
            ('Uber trip downtown', '', 'expense', 'transport'),
            ('Starbucks cappuccino', '', 'expense', 'food'),
            ('Netflix monthly plan', '', 'expense', 'entertainment'),
            ('Monthly Salary deposit', '', 'income', 'salary'),
            ('Airtel mobile wifi bill', '', 'expense', 'utilities'),
            ('Prescription pharmacy medicine', '', 'expense', 'healthcare'),
        ]

        for title, desc, tx_type, expected_cat in test_cases:
            result = suggest_category(title, desc, tx_type=tx_type)
            self.assertEqual(result['suggested_category'], expected_cat, f"Failed for '{title}'")

    def test_ambiguous_category_suggestion(self):
        result = suggest_category('Miscellaneous payment 12345', '')
        self.assertIn(result['confidence_label'], ['low', 'medium'])
        self.assertIn('suggested_category', result)


class RecurringPaymentDetectionTests(FinSightTestCase):
    def test_detect_monthly_recurring_pattern(self):
        # Create 3 monthly Netflix payments
        base_date = date.today() - timedelta(days=90)
        Expense.objects.create(user=self.user, title='Netflix Subscription', amount=Decimal('649.00'), date=base_date, type='expense', category='entertainment')
        Expense.objects.create(user=self.user, title='Netflix Subscription', amount=Decimal('649.00'), date=base_date + timedelta(days=30), type='expense', category='entertainment')
        Expense.objects.create(user=self.user, title='Netflix Subscription', amount=Decimal('649.00'), date=base_date + timedelta(days=60), type='expense', category='entertainment')

        res = self.client.get(reverse('recurring_expense-detect'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        candidates = res.data['candidates']
        self.assertTrue(len(candidates) >= 1)
        netflix = next((p for p in candidates if 'netflix' in p['title'].lower()), None)
        self.assertIsNotNone(netflix)
        self.assertEqual(netflix['detected_frequency'], 'monthly')
        self.assertIn(netflix['confidence'], ['high', 'medium'])


class ExpenseForecastingTests(FinSightTestCase):
    def test_forecast_with_insufficient_history(self):
        # Only 1 expense today
        Expense.objects.create(user=self.user, title='Groceries', amount=Decimal('1000.00'), date=date.today(), type='expense', category='groceries')

        res = self.client.get(reverse('expense-forecast'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertFalse(data['sufficient_history'])
        self.assertIn('disclaimer', data)
        self.assertTrue(len(data['message']) > 0)

    def test_forecast_with_sufficient_history(self):
        # Create 3 consecutive past complete months of expenses
        today = date.today()
        current_m = today.replace(day=1)
        m1 = (current_m - timedelta(days=90)).replace(day=15)
        m2 = (current_m - timedelta(days=60)).replace(day=15)
        m3 = (current_m - timedelta(days=30)).replace(day=15)
        
        Expense.objects.create(user=self.user, title='Rent M1', amount=Decimal('10000.00'), date=m1, type='expense', category='housing')
        Expense.objects.create(user=self.user, title='Rent M2', amount=Decimal('12000.00'), date=m2, type='expense', category='housing')
        Expense.objects.create(user=self.user, title='Rent M3', amount=Decimal('14000.00'), date=m3, type='expense', category='housing')

        res = self.client.get(reverse('expense-forecast'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertTrue(data['sufficient_history'])
        self.assertIn('forecast_amount', data)
        # Average of (10000 + 12000 + 14000) / 3 = 12000
        self.assertEqual(data['forecast_amount'], 12000.0)
        self.assertEqual(len(data['periods_used']), 3)
        self.assertIn('disclaimer', data)


class UnusualSpendingDetectionTests(FinSightTestCase):
    def test_detect_unusual_spending_anomaly(self):
        today = date.today()
        # Normal restaurant dining bills (around 300 - 500)
        for i in range(8):
            Expense.objects.create(
                user=self.user,
                title=f'Dinner {i}',
                amount=Decimal('400.00'),
                date=today - timedelta(days=i * 3 + 1),
                type='expense',
                category='food'
            )

        # Huge unusual dinner bill
        outlier = Expense.objects.create(
            user=self.user,
            title='Luxury Banquet Dinner',
            amount=Decimal('8500.00'),
            date=today,
            type='expense',
            category='food'
        )

        res = self.client.get(reverse('expense-unusual-spending'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        unusual = res.data['unusual_transactions']
        self.assertTrue(len(unusual) >= 1)
        outlier_item = next((item for item in unusual if item['id'] == outlier.id), None)
        self.assertIsNotNone(outlier_item)
        self.assertEqual(outlier_item['status_label'], 'Unusual Spending')
        self.assertIn('standard deviations', outlier_item['explanation'].lower())


class CSVImportExportTests(FinSightTestCase):
    def test_csv_import_valid_and_deduplication(self):
        csv_text = (
            "title,amount,date,category,type,description\n"
            "Coffee,150.00,2026-04-01,food,expense,Espresso\n"
            "Monthly Salary,50000.00,2026-04-01,salary,income,Direct deposit\n"
        )
        url = reverse('expense-import-csv')
        res = self.client.post(url, {'csv_data': csv_text}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['imported_count'], 2)
        self.assertEqual(Expense.objects.count(), 2)

        # Import identical CSV again -> should deduplicate / skip
        res2 = self.client.post(url, {'csv_data': csv_text}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['imported_count'], 0)
        self.assertEqual(res2.data['skipped_count'], 2)
        self.assertEqual(Expense.objects.count(), 2)

    def test_csv_export(self):
        Expense.objects.create(user=self.user, title='Book', amount=Decimal('350.00'), date=date.today(), type='expense', category='education')
        url = reverse('expense-export-csv')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'text/csv')
        content = res.content.decode('utf-8')
        self.assertIn('Book', content)
        self.assertIn('350', content)
        self.assertIn('Education', content)


class LargeExpenseAndDateHandlingTests(FinSightTestCase):
    def test_large_expense_with_low_income_does_not_corrupt_stats(self):
        today = date.today()
        # User earns 40,000 and spends 10,00,000 (10 lakhs)
        Expense.objects.create(
            user=self.user,
            title='Salary',
            amount=Decimal('40000.00'),
            date=today,
            type='income',
            category='salary'
        )
        Expense.objects.create(
            user=self.user,
            title='Car Purchase',
            amount=Decimal('1000000.00'),
            date=today,
            type='expense',
            category='transport'
        )

        url = reverse('expense-stats')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertEqual(float(data['total_income']), 40000.00)
        self.assertEqual(float(data['total_expenses']), 1000000.00)
        self.assertEqual(float(data['net_cash_flow']), -960000.00)
        # Savings rate = (-960,000 / 40,000) * 100 = -2400.0%
        self.assertEqual(float(data['savings_rate']), -2400.00)
        self.assertEqual(float(data['this_month_savings_rate']), -2400.00)

    def test_crore_scale_large_expense(self):
        today = date.today()
        # ₹1,00,00,000 (1 crore) expense
        Expense.objects.create(
            user=self.user,
            title='House Purchase',
            amount=Decimal('10000000.00'),
            date=today,
            type='expense',
            category='housing'
        )
        url = reverse('expense-stats')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(float(res.data['total_expenses']), 10000000.00)

    def test_future_dated_transaction_does_not_affect_current_month_actuals(self):
        today = date.today()
        tomorrow = today + timedelta(days=1)
        yesterday = today - timedelta(days=1)

        # Expense yesterday (incurred)
        Expense.objects.create(
            user=self.user,
            title='Groceries Yesterday',
            amount=Decimal('500.00'),
            date=yesterday,
            type='expense',
            category='groceries'
        )
        # Expense today (incurred)
        Expense.objects.create(
            user=self.user,
            title='Lunch Today',
            amount=Decimal('200.00'),
            date=today,
            type='expense',
            category='food'
        )
        # Future expense (scheduled for tomorrow or future date)
        Expense.objects.create(
            user=self.user,
            title='Planned Concert Tomorrow',
            amount=Decimal('3000.00'),
            date=tomorrow,
            type='expense',
            category='entertainment'
        )

        url = reverse('expense-stats')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        # Today's expenses must only include today
        self.assertEqual(float(data['today_expenses']), 200.00)

        # Month expenses must include yesterday (500) + today (200) = 700
        # and MUST NOT include tomorrow's 3000!
        # Note: if yesterday was in previous month (1st of month), adjust expectation
        expected_month = 200.00 + (500.00 if yesterday.month == today.month else 0.00)
        self.assertEqual(float(data['this_month_expenses']), expected_month)

        # But all-time total expenses includes all records
        self.assertEqual(float(data['total_expenses']), 3700.00)

