"""Add password_reset_tokens table for password reset functionality

Revision ID: 0003_add_password_reset_tokens
Revises: 0002_add_date_of_birth
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '0003_add_password_reset_tokens'
down_revision: Union[str, None] = '0002_add_date_of_birth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create password_reset_tokens table"""
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.String(36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('token', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.String(1), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    """Drop password_reset_tokens table"""
    op.drop_table('password_reset_tokens')
