"""
Birthday email service - sends birthday wishes to users on their birthday.
"""
import logging
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract
from typing import Optional
from app.models.session import User
from app.services.email_service import email_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class BirthdayService:
    """Service for handling birthday emails"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.enabled = settings.BIRTHDAY_EMAILS_ENABLED
    
    async def get_users_with_birthday_today(self) -> list[User]:
        """
        Get all users whose birthday is today (month and day match current date).
        Excludes users without a date_of_birth set.
        """
        if not self.enabled:
            logger.debug("Birthday emails are disabled")
            return []
        
        today = date.today()
        month = today.month
        day = today.day
        
        # Use SQLAlchemy extract for portable date part extraction
        stmt = select(User).where(
            User.date_of_birth.isnot(None),
            extract('month', User.date_of_birth) == month,
            extract('day', User.date_of_birth) == day
        )
        
        try:
            result = await self.db.execute(stmt)
            users = result.scalars().all()
            logger.info(f"Found {len(users)} users with birthdays today ({month}/{day})")
            return list(users)
        except Exception as e:
            logger.error(f"Error fetching birthday users: {e}")
            return []
    
    async def send_birthday_email_to_user(self, user: User) -> bool:
        """Send birthday email to a single user"""
        try:
            subject, html_body, text_body = email_service.build_birthday_email(
                username=user.username,
                email=user.email
            )
            
            success = await email_service.send_email(
                to_email=user.email,
                subject=subject,
                html_body=html_body,
                text_body=text_body
            )
            
            if success:
                logger.info(f"Birthday email sent to {user.username} ({user.email})")
            else:
                logger.error(f"Failed to send birthday email to {user.username}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending birthday email to {user.username}: {e}")
            return False
    
    async def send_birthday_emails(self) -> dict:
        """
        Send birthday emails to all users celebrating birthdays today.
        Returns a summary dict with counts and results.
        """
        try:
            if not self.enabled:
                logger.info("Birthday emails are disabled by configuration")
                return {"sent": 0, "failed": 0, "total_checked": 0, "disabled": True}
            
            users = await self.get_users_with_birthday_today()
            
            if not users:
                logger.info("No birthdays today")
                return {"sent": 0, "failed": 0, "total_checked": 0}
            
            sent_count = 0
            failed_count = 0
            
            for user in users:
                success = await self.send_birthday_email_to_user(user)
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
            
            logger.info(f"Birthday email batch complete: {sent_count} sent, {failed_count} failed out of {len(users)} users")
            
            return {
                "sent": sent_count,
                "failed": failed_count,
                "total_checked": len(users)
            }
        except Exception as e:
            logger.error(f"Failed to send birthday emails: {e}")
            return {"sent": 0, "failed": 0, "error": str(e)}


async def send_birthday_emails_task(db: AsyncSession) -> dict:
    """
    Standalone function to be called as a background task.
    Creates a BirthdayService and sends birthday emails.
    """
    service = BirthdayService(db)
    return await service.send_birthday_emails()
