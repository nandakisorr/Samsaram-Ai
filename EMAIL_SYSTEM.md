# Email System Documentation

## Overview

The chatbot application includes a comprehensive email system that supports:
- **Welcome Emails** - Sent automatically to new users upon registration
- **Password Reset Emails** - Sent when users request a password reset
- **Birthday Wishes** - Sent daily to users celebrating their birthday (if date_of_birth is set)

All emails are sent via **EmailHooks API** (`emails-api.eventhooks.io`), a reliable email delivery service, or fallback to SMTP/console/file for development.

---

## Architecture

### Components

1. **EmailService** (`app/services/email_service.py`)
   - Unified email sending interface supporting multiple backends
   - Builds HTML and plain-text email templates
   - Handles delivery via configured backend

2. **AuthService** (`app/services/auth_service.py`)
   - Triggers welcome email on successful user registration
   - Sends password reset emails on request

3. **BirthdayService** (`app/services/birthday_service.py`)
   - Daily scheduled task that runs at midnight UTC
   - Finds users with birthdays today
   - Sends personalized birthday wish emails

4. **Email Routes** (`app/routes/auth.py`)
   - Password reset request endpoints
   - Admin endpoint for manually triggering birthday emails (`/api/v1/auth/admin/send-birthday-emails`)

---

## Email Templates

### Welcome Email
- **Trigger**: User registration
- **Content**: Account creation confirmation, getting started guide, feature highlights
- **Template method**: `EmailService.build_welcome_email(username, email)`

### Password Reset Email
- **Trigger**: Forgot password request
- **Content**: Secure reset link, expiry notice, security tips
- **Template method**: `EmailService.build_password_reset_email(reset_url, username, expires_hours)`

### Birthday Email
- **Trigger**: Daily check — user's birthday matches current date
- **Content**: Birthday wishes, special offer/discount, appreciation message
- **Template method**: `EmailService.build_birthday_email(username, email)`

All emails include both HTML and plain-text versions for maximum compatibility.

---

## Configuration

### Environment Variables (`.env`)

#### Core Email Settings
```bash
# Enable/disable all email sending
EMAIL_ENABLED=true

# Backend: smtp, console, file, or emailhooks
EMAIL_BACKEND=emailhooks

# Sender details
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=Samsaram AI
EMAIL_SUBJECT_PREFIX=[Chatbot]
```

#### EmailHooks API (Recommended for Production)
```bash
EMAILHOOKS_API_KEY=ak_your_emailhooks_api_key_here
EMAILHOOKS_API_SECRET=sk_your_emailhooks_api_secret_here
EMAILHOOKS_BASE_URL=https://emails-api.eventhooks.io/api/v1
```
Get credentials from: https://emails-api.eventhooks.io

#### SMTP (Alternative)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

#### Password Reset
```bash
PASSWORD_RESET_TOKEN_EXPIRE_HOURS=24
FRONTEND_URL=http://localhost:5173  # Used in reset link
```

#### Birthday Emails
```bash
BIRTHDAY_EMAILS_ENABLED=true
BIRTHDAY_CHECK_SCHEDULE=daily  # Runs daily at midnight UTC
```

#### Branding (used in email templates)
```bash
APP_NAME=Samsaram AI
WEBSITE_URL=https://samsaram-ai.com
```

---

## Backend Selection

| Backend | Use Case | Notes |
|---------|----------|-------|
| `emailhooks` | Production (recommended) | Uses EmailHooks API — high deliverability, analytics, scalable |
| `smtp` | Production with own SMTP | Direct SMTP server (Gmail, SendGrid, Mailgun, etc.) |
| `console` | Development | Logs emails to terminal only (no actual delivery) |
| `file` | Debugging | Saves emails as `.html` files in `logs/emails/` |

Switch backends by changing `EMAIL_BACKEND` in `.env`.

---

## Birthday Email Scheduler

The birthday email system runs as a **background task** within the FastAPI application:

- **Startup**: Scheduler starts automatically when the app launches
- **Schedule**: Runs daily at **midnight UTC**
- **Query**: Finds all users with `date_of_birth` matching current month & day
- **Delivery**: Sends birthday email to each matching user via the configured email backend
- **Graceful shutdown**: Task is cancelled cleanly when the app stops

To manually trigger birthday email delivery (bypassing the schedule):
```bash
POST /api/v1/auth/admin/send-birthday-emails
Authorization: Bearer <admin_token>
```

---

## Database Requirements

### User Model
The `User` model includes a `date_of_birth` field (type `Date`, nullable). This is required for birthday emails:
- Optional during registration (`RegisterRequest.date_of_birth`)
- If set, users receive birthday wishes annually
- No data is sent to email service except username and email

### Password Reset Tokens
The `PasswordResetToken` model stores reset tokens with expiry and used status.

---

## Error Handling

- **Registration failures**: Welcome email errors are **non-blocking** — user registration succeeds even if email sending fails. Errors are logged.
- **Password reset failures**: If email fails to send, the API returns a failure message to the client to retry.
- **Birthday batch failures**: Failed emails are logged individually; the batch continues processing other users. Summary is returned.
- **EmailHooks errors**: HTTP errors from EmailHooks API are caught and logged with details.

All email errors are logged with `logger.error()` but do not crash the application.

---

## Testing

### 1. Console Backend (Development)
```bash
# .env
EMAIL_BACKEND=console
```
Registration, password reset, or manual birthday trigger will log full email content to the terminal.

### 2. File Backend (Debugging)
```bash
EMAIL_BACKEND=file
```
Emails saved to `logs/emails/email_<timestamp>_<user>.html`

### 3. EmailHooks Backend (Production)
1. Get API credentials from https://emails-api.eventhooks.io
2. Set in `.env`:
   ```bash
   EMAIL_BACKEND=emailhooks
   EMAILHOOKS_API_KEY=ak_...
   EMAILHOOKS_API_SECRET=sk_...
   ```
3. Test by registering a new user or triggering birthday emails manually

### 4. Manual Birthday Test
```bash
curl -X POST "http://localhost:8000/api/v1/auth/admin/send-birthday-emails" \
  -H "Authorization: Bearer <your-jwt-token>"
```
Response:
```json
{
  "success": true,
  "message": "Birthday email task completed",
  "result": { "sent": 3, "failed": 0, "total_checked": 3 }
}
```

---

## Security Considerations

- **Email enumeration protection**: Password reset returns the same generic message whether or not the email exists (`"If an account exists with this email..."`)
- **Token security**: Password reset tokens are cryptographically secure (`secrets.token_urlsafe(32)`) and expire in 24 hours
- **Token lifecycle**: Tokens are single-use; marked as `used` after successful password reset
- **EmailHooks credentials**: Stored in `.env` (never committed to Git). Use environment variables in production.
- **No sensitive data in emails**: Reset links contain only the token; passwords are never emailed

---

## Frontend Integration

### Registration (`/api/v1/auth/register`)
- POST with `username`, `email`, `password`, `date_of_birth` (optional)
- Returns user object
- **Side effect**: Welcome email sent asynchronously

### Password Reset Flow
1. Client calls `/api/v1/auth/request-reset` with user's email
2. Server sends email with reset link to frontend URL: `{FRONTEND_URL}/reset-password?token=...`
3. Client verifies token via `/api/v1/auth/verify-reset-token/{token}`
4. Client submits new password via `/api/v1/auth/reset-password`

### Birthday Emails
- No frontend action required
- Automatic daily delivery to eligible users
- Admin can manually trigger via `/api/v1/auth/admin/send-birthday-emails`

---

## Troubleshooting

### Emails not sending
1. Check `EMAIL_ENABLED=true` in `.env`
2. Verify `EMAIL_BACKEND` is set correctly
3. For `emailhooks`: confirm `EMAILHOOKS_API_KEY` and `EMAILHOOKS_API_SECRET` are valid
4. Check application logs for `ERROR` level messages from `EmailService` or `birthday_service`

### Birthday emails not going out
1. Confirm `BIRTHDAY_EMAILS_ENABLED=true`
2. Verify scheduler started: Look for log message `"Birthday scheduler started"`
3. Ensure users have `date_of_birth` set in the database
4. Check that the scheduler hasn't crashed (logs will show errors)
5. Manually trigger via `/api/v1/auth/admin/send-birthday-emails` to test

### EmailHooks 400/401 errors
- Invalid API key/secret
- Check that you're using `EMAILHOOKS_BASE_URL=https://emails-api.eventhooks.io/api/v1`

### SMTP authentication failed
- For Gmail: use App Password (2FA required), not regular account password
- Ensure `EMAIL_USE_TLS=true` for port 587
- Check that `EMAIL_HOST_USER` matches the account

---

## Deployment Notes

- Set `EMAIL_BACKEND=emailhooks` in production for best deliverability
- Add real `EMAILHOOKS_API_KEY` and `EMAILHOOKS_API_SECRET` as environment variables (not in `.env` if using container orchestration)
- Ensure `FRONTEND_URL` points to the deployed frontend URL
- Keep `EMAIL_ENABLED=false` only if you want to disable all email sending (e.g., maintenance)
- Birthday scheduler runs in the same process as the FastAPI app — ensure only one instance of the app is running to avoid duplicate emails (use database locking if running multiple workers)

---

## Extending the Email System

To add a new email type:

1. **Add template method** to `EmailService` (e.g., `build_<type>_email()`)
2. **Call from appropriate service** (e.g., `AuthService`, `BirthdayService`)
3. **Use `email_service.send_email()`** to deliver
4. **Add config** (if needed) to `config.py` and `.env.example`

Example:
```python
# In email_service.py
def build_notification_email(self, user: str, message: str) -> tuple[str, str, str]:
    subject = f"Notification — {settings.APP_NAME}"
    html_body = f"<html><body><h1>Hello {user}</h1><p>{message}</p></body></html>"
    text_body = f"Hello {user}\n{message}"
    return subject, html_body, text_body

# In any service
subject, html, text = email_service.build_notification_email("John", "Your quota is full")
await email_service.send_email(to_email="john@example.com", subject=subject, html_body=html, text_body=text)
```
