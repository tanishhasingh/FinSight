from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.core import mail
from decimal import Decimal
from accounts.models import User
from accounts.email_utils import generate_verification_token, verify_email_token


class EmailVerificationAndAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.verified_user = User.objects.create_user(
            username='verified_user',
            email='verified@example.com',
            password='Password@123',
            first_name='Verified',
            last_name='User',
            currency='INR',
            is_email_verified=True
        )

    def test_user_registration_creates_unverified_user_and_sends_email(self):
        url = reverse('register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePassword@123',
            'password_confirm': 'SecurePassword@123',
            'first_name': 'New',
            'last_name': 'Person',
            'currency': 'INR'
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('requires_verification'))

        # User exists in database as unverified
        new_user = User.objects.get(email='newuser@example.com')
        self.assertFalse(new_user.is_email_verified)

        # Verification email was queued / sent
        self.assertGreaterEqual(len(mail.outbox), 1)
        self.assertIn("Verify your FinSight account", mail.outbox[-1].subject)
        self.assertIn("verify-email?token=", mail.outbox[-1].body)

    def test_unverified_user_blocked_from_login(self):
        unverified = User.objects.create_user(
            username='unverified_user',
            email='unverified@example.com',
            password='Password@123',
            is_email_verified=False
        )
        url = reverse('token_obtain_pair')
        res = self.client.post(url, {'email': 'unverified@example.com', 'password': 'Password@123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not verified', str(res.data))

        # Also check custom login_view
        url_custom = reverse('login')
        res_custom = self.client.post(url_custom, {'email': 'unverified@example.com', 'password': 'Password@123'}, format='json')
        self.assertEqual(res_custom.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_custom.data.get('unverified'))

    def test_verified_user_can_login_successfully(self):
        url = reverse('token_obtain_pair')
        res = self.client.post(url, {'email': 'verified@example.com', 'password': 'Password@123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

    def test_verify_email_endpoint_valid_token(self):
        user = User.objects.create_user(
            username='to_verify',
            email='to_verify@example.com',
            password='Password@123',
            is_email_verified=False
        )
        token = generate_verification_token(user)

        url = reverse('verify_email')
        res = self.client.post(url, {'token': token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('verified'))

        # Database state refreshed
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_verify_email_endpoint_invalid_token(self):
        url = reverse('verify_email')
        res = self.client.post(url, {'token': 'invalid-token-tampered:1234'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res.data)

    def test_verify_already_verified_token(self):
        token = generate_verification_token(self.verified_user)
        url = reverse('verify_email')
        res = self.client.post(url, {'token': token}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('already_verified'))

    def test_resend_verification_email(self):
        user = User.objects.create_user(
            username='resend_user',
            email='resend@example.com',
            password='Password@123',
            is_email_verified=False
        )
        mail.outbox.clear()

        url = reverse('resend_verification')
        res = self.client.post(url, {'email': 'resend@example.com'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['resend@example.com'])

    def test_duplicate_email_registration_rejected(self):
        url = reverse('register')
        data = {
            'username': 'anotheruser',
            'email': 'verified@example.com', # Already in DB
            'password': 'SecurePassword@123',
            'password_confirm': 'SecurePassword@123',
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(res.data))


class ProfileAndSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='profile_user',
            email='profile@example.com',
            password='Password@123',
            first_name='Original',
            last_name='Name',
            currency='INR',
            is_email_verified=True
        )
        self.client.force_authenticate(user=self.user)

    def test_update_profile_first_and_last_name_and_currency(self):
        url = reverse('user_profile')
        payload = {
            'first_name': 'Aarav',
            'last_name': 'Sharma',
            'currency': 'USD',
        }
        res = self.client.put(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('first_name'), 'Aarav')
        self.assertEqual(res.data.get('last_name'), 'Sharma')
        self.assertEqual(res.data.get('currency'), 'USD')

        # Verify DB persistence
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Aarav')
        self.assertEqual(self.user.last_name, 'Sharma')
        self.assertEqual(self.user.currency, 'USD')

    def test_update_profile_camel_case_input(self):
        url = reverse('user_profile')
        payload = {
            'firstName': 'Priya',
            'lastName': 'Patel',
            'currency': 'EUR',
        }
        res = self.client.put(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('firstName'), 'Priya')
        self.assertEqual(res.data.get('lastName'), 'Patel')

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Priya')
        self.assertEqual(self.user.last_name, 'Patel')
        self.assertEqual(self.user.currency, 'EUR')

    def test_appearance_settings_persistence(self):
        url = reverse('budget_management')
        payload = {
            'preferences': {
                'dark_mode': True,
                'theme_color': 'orange',
                'compact_mode': True,
            }
        }
        res = self.client.put(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.dark_mode)
        self.assertEqual(self.user.theme_color, 'orange')
        self.assertTrue(self.user.compact_mode)
