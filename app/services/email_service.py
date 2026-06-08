"""
Email service for sending password reset links and other notifications.
Supports multiple backends: SMTP, console (dev), file (debug), EmailHooks (API).
"""
import logging
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from typing import Optional
from pathlib import Path
from datetime import datetime
import re

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via configured backend"""

    def __init__(self):
        self.enabled = settings.EMAIL_ENABLED
        self.backend = settings.EMAIL_BACKEND.lower()
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
        self.subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def _build_message(self, to_email: str, subject: str, body_html: str, body_text: Optional[str] = None) -> MIMEMultipart:
        """Build a MIME email message"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = self.subject_prefix + subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        msg['Date'] = formatdate(localtime=True)
        msg['Message-ID'] = make_msgid()

        # Plain text fallback
        if body_text is None:
            body_text = self._html_to_text(body_html)
        msg.attach(MIMEText(body_text, 'plain'))
        msg.attach(MIMEText(body_html, 'html'))

        return msg

    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text for email clients that don't support HTML"""
        text = re.sub(r'<br\s*/?>', '\n', html)
        text = re.sub(r'<p[^>]*>', '\n', text)
        text = re.sub(r'</p>', '\n', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\n+', '\n', text)
        return text.strip()

    async def send_email_async(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Send email asynchronously (wraps sync method)"""
        return await self.send_email(to_email, subject, html_body, text_body)

    async def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Send email via configured backend"""
        if not self.enabled:
            logger.info("Email sending is disabled")
            return False

        msg = self._build_message(to_email, subject, html_body, text_body)

        try:
            if self.backend == "smtp":
                return self._send_smtp(msg)
            elif self.backend == "console":
                return self._send_console(msg)
            elif self.backend == "file":
                return self._send_file(msg)
            elif self.backend == "emailhooks":
                return await self._send_emailhooks(to_email, subject, html_body, text_body)
            else:
                logger.error(f"Unknown email backend: {self.backend}")
                return False
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    def _send_smtp(self, msg: MIMEMultipart) -> bool:
        """Send via SMTP"""
        try:
            with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
                if settings.EMAIL_USE_TLS:
                    server.starttls()
                if settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD:
                    server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                server.send_message(msg)
            logger.info(f"Email sent to {msg['To']} via SMTP")
            return True
        except Exception as e:
            logger.error(f"SMTP error: {e}")
            return False

    def _send_console(self, msg: MIMEMultipart) -> bool:
        """Print email to console (dev only)"""
        logger.info(f"[EMAIL CONSOLE] To: {msg['To']}")
        logger.info(f"Subject: {msg['Subject']}")
        logger.debug(f"Body (HTML):\n{msg.get_payload(1).get_payload(decode=True).decode()}")
        return True

    def _send_file(self, msg: MIMEMultipart) -> bool:
        """Save email to file for debugging"""
        log_dir = Path("logs/emails")
        log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = log_dir / f"email_{timestamp}_{msg['To'].replace('@', '_at_')}.html"

        html_body = msg.get_payload(1).get_payload(decode=True).decode()
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"To: {msg['To']}\n")
            f.write(f"Subject: {msg['Subject']}\n")
            f.write(f"Date: {msg['Date']}\n")
            f.write(f"\n{html_body}\n")
        logger.info(f"Email saved to {filename}")
        return True

    async def _send_emailhooks(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Send email via EmailHooks API"""
        if not settings.EMAILHOOKS_API_KEY or not settings.EMAILHOOKS_API_SECRET:
            logger.error("EmailHooks API credentials not configured")
            return False

        headers = {
            "X-API-Key": settings.EMAILHOOKS_API_KEY,
            "X-API-Secret": settings.EMAILHOOKS_API_SECRET,
            "Content-Type": "application/json",
        }

        payload = {
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body or self._html_to_text(html_body),
            "from_email": settings.EMAIL_FROM,
            "from_name": settings.EMAIL_FROM_NAME,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.EMAILHOOKS_BASE_URL}/emails/send",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                result = response.json()
                if result.get("success"):
                    logger.info(f"Email sent to {to_email} via EmailHooks")
                    return True
                else:
                    logger.error(f"EmailHooks error: {result.get('error', 'Unknown error')}")
                    return False
        except httpx.HTTPStatusError as e:
            logger.error(f"EmailHooks HTTP error {e.response.status_code}: {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"EmailHooks request failed: {e}")
            return False

    def build_welcome_email(self, username: str, email: str) -> tuple[str, str, str]:
        """Build welcome email for new user registration"""
        subject = f"Welcome to {settings.APP_NAME}!"

        app_name = settings.APP_NAME
        website_url = settings.WEBSITE_URL

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }}
                .welcome-msg {{ font-size: 20px; color: #4f46e5; font-weight: bold; margin-bottom: 10px; }}
                .features {{ margin: 25px 0; }}
                .feature-item {{ padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
                .feature-item:last-child {{ border-bottom: none; }}
                .feature-icon {{ font-size: 20px; margin-right: 10px; }}
                .cta-button {{ display: inline-block; background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }}
                .divider {{ height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✨ Welcome to {app_name}!</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>{username}</strong>,</p>

                    <div class="welcome-msg">
                        🎉 Thank you for joining {app_name}!
                    </div>

                    <p>Your account has been successfully created. You now have access to our intelligent AI chatbot with:</p>

                    <div class="features">
                        <div class="feature-item">
                            <span class="feature-icon">💬</span>
                            <strong>Multilingual Conversations</strong> – Chat in your preferred language with automatic detection
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🗣️</span>
                            <strong>Voice Interaction</strong> – Speak to the AI and receive spoken responses
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🎯</span>
                            <strong>Smart Assistance</strong> – Get help with coding, writing, analysis, and creative tasks
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🌐</span>
                            <strong>Session History</strong> – Access your previous conversations anytime, anywhere
                        </div>
                    </div>

                    <div class="divider"></div>

                    <p style="text-align: center;">
                        <a href="{website_url}" class="cta-button">Start Chatting Now</a>
                    </p>

                    <p>
                        <strong>Getting started:</strong>
                    </p>
                    <ol style="padding-left: 20px;">
                        <li>Visit {website_url}</li>
                        <li>Log in with your credentials</li>
                        <li>Start typing or use the voice button to speak</li>
                        <li>Toggle text-to-speech to hear responses</li>
                    </ol>

                    <div style="background-color: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                        <strong>🔐 Security Tip:</strong> Keep your password safe and never share it with anyone.
                    </div>

                    <p>
                        If you have any questions or need assistance, feel free to reach out to our support team.
                    </p>

                    <p>Welcome aboard! 🚀</p>

                    <p>Best regards,<br>The {app_name} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from {app_name}. Please do not reply to this email.</p>
                    <p>&copy; 2024 {app_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Welcome to {app_name}!

        Hello {username},

        🎉 Thank you for joining {app_name}! Your account has been successfully created.

        You now have access to:
        • Multilingual Conversations – Chat in your preferred language
        • Voice Interaction – Speak to the AI and receive spoken responses
        • Smart Assistance – Get help with coding, writing, analysis, and creative tasks
        • Session History – Access your previous conversations anytime

        Getting started:
        1. Visit {website_url}
        2. Log in with your credentials
        3. Start typing or use the voice button to speak
        4. Toggle text-to-speech to hear responses

        If you have any questions, feel free to reach out to our support team.

        Welcome aboard! 🚀

        Best regards,
        The {app_name} Team

        ---
        This is an automated message from {app_name}. Please do not reply to this email.
        """

        return subject, html_body, text_body

    def build_password_reset_email(self, reset_url: str, username: str, expires_hours: int = 24) -> tuple[str, str, str]:
        """Build password reset email"""
        subject = f"Reset Your {settings.APP_NAME} Password"

        app_name = settings.APP_NAME
        website_url = settings.WEBSITE_URL

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }}
                .reset-msg {{ font-size: 20px; color: #dc2626; font-weight: bold; margin-bottom: 10px; }}
                .cta-button {{ display: inline-block; background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
                .warning {{ background-color: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }}
                .divider {{ height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset Request</h1>
                </div>
                <div class="content">
                    <p>Hello <strong>{username}</strong>,</p>

                    <div class="reset-msg">
                        We received a request to reset your password.
                    </div>

                    <p>Click the button below to choose a new password. This link will expire in {expires_hours} hours:</p>

                    <p style="text-align: center;">
                        <a href="{reset_url}" class="cta-button">Reset Password</a>
                    </p>

                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>This link is unique and expires in {expires_hours} hours</li>
                            <li>If you didn't request this reset, please ignore this email or contact support</li>
                            <li>Never share this link with anyone</li>
                        </ul>
                    </div>

                    <div class="divider"></div>

                    <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 14px;">{reset_url}</p>

                    <p>
                        Need help? Contact our support team at <a href="mailto:support@example.com">support@example.com</a>
                    </p>

                    <p>Best regards,<br>The {app_name} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from {app_name}. Please do not reply to this email.</p>
                    <p>&copy; 2024 {app_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Password Reset Request

        Hello {username},

        We received a request to reset your {app_name} password.

        Click the link below to choose a new password (expires in {expires_hours} hours):
        {reset_url}

        ⚠️ Security Notice:
        • This link is unique and expires in {expires_hours} hours
        • If you didn't request this reset, ignore this email or contact support
        • Never share this link with anyone

        Need help? Contact us at support@example.com

        Best regards,
        The {app_name} Team

        ---
        This is an automated message from {app_name}. Please do not reply to this email.
        """

        return subject, html_body, text_body

    def build_birthday_email(self, username: str, email: str) -> tuple[str, str, str]:
        """Build birthday email for user"""
        subject = f"🎉 Happy Birthday, {username}! — {settings.APP_NAME}"

        app_name = settings.APP_NAME
        website_url = settings.WEBSITE_URL

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }}
                .birthday-msg {{ font-size: 22px; color: #d97706; font-weight: bold; margin-bottom: 15px; text-align: center; }}
                .cake-emoji {{ font-size: 40px; text-align: center; margin: 20px 0; }}
                .cta-button {{ display: inline-block; background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
                .special-offer {{ background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; }}
                .features {{ margin: 25px 0; }}
                .feature-item {{ padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
                .feature-item:last-child {{ border-bottom: none; }}
                .feature-icon {{ font-size: 20px; margin-right: 10px; }}
                .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }}
                .divider {{ height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎂 Happy Birthday!</h1>
                </div>
                <div class="content">
                    <div class="cake-emoji">🎂🎁🎈</div>

                    <div class="birthday-msg">
                        Wishing you a fantastic birthday, {username}!
                    </div>

                    <p style="text-align: center; font-size: 16px; color: #6b7280;">
                        On this special day, we're celebrating YOU! Thank you for being part of the {app_name} community.
                    </p>

                    <div class="special-offer">
                        <strong>🎁 Your Birthday Gift:</strong><br>
                        Enjoy a special 25% discount on your next premium upgrade!<br>
                        <small>Use code: BIRTHDAY25 — valid for 48 hours</small>
                    </div>

                    <div class="divider"></div>

                    <p>As a valued member, you get:</p>

                    <div class="features">
                        <div class="feature-item">
                            <span class="feature-icon">✨</span>
                            <strong>Premium Features</strong> – Unlock advanced AI capabilities
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">💎</span>
                            <strong>Priority Support</strong> – Get help when you need it
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🚀</span>
                            <strong>Early Access</strong> – Try new features before anyone else
                        </div>
                    </div>

                    <p style="text-align: center;">
                        <a href="{website_url}" class="cta-button">Celebrate & Explore</a>
                    </p>

                    <div class="divider"></div>

                    <p style="text-align: center; color: #6b7280; font-size: 14px;">
                        Need help? Contact our support team at <a href="mailto:support@example.com">support@example.com</a>
                    </p>

                    <p>Have an amazing day! 🎉</p>

                    <p>Best regards,<br>The {app_name} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from {app_name}. Please do not reply to this email.</p>
                    <p>&copy; 2024 {app_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        🎉 Happy Birthday, {username}!

        Wishing you a fantastic birthday! On this special day, we're celebrating YOU and thanking you for being part of the {app_name} community.

        🎁 Your Birthday Gift:
        Enjoy a special 25% discount on your next premium upgrade!
        Use code: BIRTHDAY25 — valid for 48 hours

        As a valued member, you get:
        • Premium Features — Unlock advanced AI capabilities
        • Priority Support — Get help when you need it
        • Early Access — Try new features before anyone else

        Have an amazing day!

        Best regards,
        The {app_name} Team

        ---
        This is an automated message from {app_name}. Please do not reply to this email.
        """

        return subject, html_body, text_body


# Global email service instance
email_service = EmailService()
