import random
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from expenses.models import Expense, CategoryBudget, SavingsGoal, RecurringExpense

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds realistic demonstration transactions, budgets, goals, and recurring patterns for FinSight'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing transactions before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("🌱 Seeding FinSight Demonstration Data..."))

        # Find or create demo user
        user, created = User.objects.get_or_create(
            email='admin@example.com',
            defaults={
                'username': 'admin',
                'first_name': 'Alex',
                'last_name': 'Morgan',
                'monthly_budget': Decimal('45000.00'),
                'alert_threshold': 80,
                'currency': 'INR'
            }
        )
        user.set_password('Admin@123')
        user.monthly_budget = Decimal('45000.00')
        user.alert_threshold = 80
        user.save()

        if options['clear']:
            Expense.objects.filter(user=user).delete()
            CategoryBudget.objects.filter(user=user).delete()
            SavingsGoal.objects.filter(user=user).delete()
            RecurringExpense.objects.filter(user=user).delete()
            self.stdout.write(self.style.WARNING("🧹 Cleared old user data."))

        today = date.today()
        # Seed across 4 calendar months (3 past months + current month)
        start_month = (today.replace(day=1) - relativedelta(months=3))

        tx_count = 0

        for month_offset in range(4):
            m_date = start_month + relativedelta(months=month_offset)
            year = m_date.year
            month = m_date.month

            # Income 1: Monthly Salary (1st of month)
            sal_date = date(year, month, 1)
            if sal_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Monthly Salary',
                    amount=Decimal('75000.00'),
                    date=sal_date,
                    type='income',
                    category='salary',
                    defaults={'description': 'FinTech Corp direct deposit salary'}
                )
                tx_count += 1

            # Income 2: Freelance consulting (15th of month)
            free_date = date(year, month, 15)
            if free_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Freelance UI/UX Project',
                    amount=Decimal('15000.00'),
                    date=free_date,
                    type='income',
                    category='freelance',
                    defaults={'description': 'Client mobile app dashboard design payout'}
                )
                tx_count += 1

            # Fixed Expense 1: Apartment Rent (3rd of month)
            rent_date = date(year, month, 3)
            if rent_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Apartment Rent',
                    amount=Decimal('18000.00'),
                    date=rent_date,
                    type='expense',
                    category='housing',
                    defaults={'description': 'Monthly residential lease payment'}
                )
                tx_count += 1

            # Fixed Expense 2: Broadband & WiFi (5th of month)
            wifi_date = date(year, month, 5)
            if wifi_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Airtel Fiber Broadband',
                    amount=Decimal('1199.00'),
                    date=wifi_date,
                    type='expense',
                    category='utilities',
                    defaults={'description': 'High speed fiber internet plan'}
                )
                tx_count += 1

            # Recurring Candidate 1: Netflix (10th of month)
            net_date = date(year, month, 10)
            if net_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Netflix Subscription',
                    amount=Decimal('649.00'),
                    date=net_date,
                    type='expense',
                    category='entertainment',
                    defaults={'description': 'Standard HD monthly streaming plan'}
                )
                tx_count += 1

            # Recurring Candidate 2: Spotify (12th of month)
            spot_date = date(year, month, 12)
            if spot_date <= today:
                Expense.objects.get_or_create(
                    user=user,
                    title='Spotify Premium',
                    amount=Decimal('119.00'),
                    date=spot_date,
                    type='expense',
                    category='entertainment',
                    defaults={'description': 'Music individual monthly plan'}
                )
                tx_count += 1

            # Groceries (Multiple per month)
            grocery_days = [4, 11, 18, 25]
            grocery_vendors = [
                ('Blinkit Quick Delivery', '2150.00'),
                ('Nature Basket Provisions', '3400.00'),
                ('Supermarket Weekly Groceries', '1850.00'),
                ('Fresh Vegetables & Fruits', '920.00')
            ]
            for idx, g_day in enumerate(grocery_days):
                g_date = date(year, month, g_day)
                if g_date <= today:
                    v_title, v_amt = grocery_vendors[idx % len(grocery_vendors)]
                    Expense.objects.get_or_create(
                        user=user,
                        title=v_title,
                        amount=Decimal(v_amt),
                        date=g_date,
                        type='expense',
                        category='groceries',
                        defaults={'description': 'Household groceries and essentials'}
                    )
                    tx_count += 1

            # Transport (Uber / Petrol)
            trans_days = [7, 14, 21, 28]
            trans_vendors = [
                ('Uber Ride to Office', '380.00'),
                ('Shell Petrol Station', '1800.00'),
                ('Uber Cab Trip', '420.00'),
                ('Metro Card Recharge', '500.00')
            ]
            for idx, t_day in enumerate(trans_days):
                t_date = date(year, month, t_day)
                if t_date <= today:
                    v_title, v_amt = trans_vendors[idx % len(trans_vendors)]
                    Expense.objects.get_or_create(
                        user=user,
                        title=v_title,
                        amount=Decimal(v_amt),
                        date=t_date,
                        type='expense',
                        category='transport',
                        defaults={'description': 'Daily commute and transit'}
                    )
                    tx_count += 1

            # Dining & Cafes
            food_days = [2, 9, 16, 23, 27]
            food_vendors = [
                ('Starbucks Coffee', '420.00'),
                ('Swiggy Gourmet Delivery', '850.00'),
                ('Team Lunch Bistro', '1250.00'),
                ('McDonalds Meal', '540.00'),
                ('Chai Point Tea & Snacks', '280.00')
            ]
            for idx, f_day in enumerate(food_days):
                f_date = date(year, month, f_day)
                if f_date <= today:
                    v_title, v_amt = food_vendors[idx % len(food_vendors)]
                    Expense.objects.get_or_create(
                        user=user,
                        title=v_title,
                        amount=Decimal(v_amt),
                        date=f_date,
                        type='expense',
                        category='food',
                        defaults={'description': 'Coffee, dining and takeout'}
                    )
                    tx_count += 1

        # Seed One Outlier for Unusual-Spending Anomaly Detection (1 month ago)
        outlier_date = today.replace(day=1) - timedelta(days=12)
        Expense.objects.get_or_create(
            user=user,
            title='Apple Store - MacBook Screen Repair',
            amount=Decimal('28500.00'),
            date=outlier_date,
            type='expense',
            category='shopping',
            defaults={'description': 'Out-of-warranty hardware emergency display repair'}
        )
        tx_count += 1

        # Seed Category Budgets
        budgets_data = [
            ('groceries', Decimal('9000.00')),
            ('food', Decimal('5000.00')),
            ('transport', Decimal('4000.00')),
            ('utilities', Decimal('3000.00')),
            ('entertainment', Decimal('2000.00')),
        ]
        for cat, limit in budgets_data:
            CategoryBudget.objects.get_or_create(
                user=user,
                category=cat,
                defaults={'limit': limit}
            )

        # Seed Savings Goals
        SavingsGoal.objects.get_or_create(
            user=user,
            title='Emergency Fund (6 Months Expenses)',
            defaults={
                'target_amount': Decimal('150000.00'),
                'current_amount': Decimal('85000.00'),
                'target_date': today + timedelta(days=180),
                'category': 'Emergency',
            }
        )
        SavingsGoal.objects.get_or_create(
            user=user,
            title='New M4 MacBook Pro',
            defaults={
                'target_amount': Decimal('120000.00'),
                'current_amount': Decimal('48000.00'),
                'target_date': today + timedelta(days=90),
                'category': 'Technology',
            }
        )

        self.stdout.write(self.style.SUCCESS(f"✅ Successfully seeded {tx_count} transactions across 4 months."))
        self.stdout.write(self.style.SUCCESS("✅ Created Category Budgets (Groceries, Food, Transport, Utilities, Entertainment)."))
        self.stdout.write(self.style.SUCCESS("✅ Created Savings Goals (Emergency Fund, M4 MacBook Pro)."))
        self.stdout.write(self.style.SUCCESS("✅ Created Recurring Payment patterns (Netflix ₹649, Spotify ₹119)."))
        self.stdout.write(self.style.SUCCESS("✅ Created Unusual Spending Outlier (Apple Repair ₹28,500)."))
        self.stdout.write(self.style.NOTICE("\n🔑 Demo Credentials:"))
        self.stdout.write("   Email:    admin@example.com")
        self.stdout.write("   Password: Admin@123\n")
