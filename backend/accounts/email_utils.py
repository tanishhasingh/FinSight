import os
import logging
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.core.mail import send_mail
from django.conf import settings
from .models import User

logger = logging.getLogger(__name__)
signer = TimestampSigner(salt='email-verification')


def generate_verification_token(user: User) -> str:
    """
    Generate a time-limited, cryptographically signed token for email verification.
    """
    return signer.sign(str(user.pk))


def verify_email_token(token: str, max_age: int = 86400):
    """
    Validate a verification token.
    Returns: (user, error_message)
    """
    try:
        user_id = signer.unsign(token, max_age=max_age)
        user = User.objects.get(pk=user_id)
        return user, None
    except SignatureExpired:
        return None, "Verification link has expired. Please request a new verification email."
    except (BadSignature, User.DoesNotExist):
        return None, "Invalid verification link. Please check the URL or request a new one."


def send_verification_email(user: User, request=None) -> bool:
    """
    Send an email verification message using Django's email backend.
    In development, this outputs to the console backend.
    In production, this uses the configured SMTP server.
    """
    token = generate_verification_token(user)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    verify_url = f"{frontend_url.rstrip('/')}/verify-email?token={token}"

    subject = "Verify your FinSight account"
    message = f"""Hello {user.first_name or user.username},

Thank you for registering with FinSight — Intelligent Personal Finance Manager!

Please click the link below to verify your email address and activate your account:
{verify_url}

This verification link will expire in 24 hours.

If you did not register for a FinSight account, please disregard this email.

Best regards,
The FinSight Team
"""

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Verification email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {user.email}: {e}")
        return False
