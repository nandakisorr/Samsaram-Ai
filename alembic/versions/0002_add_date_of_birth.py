"""Add date_of_birth column to users table

Revision ID: 0002_add_date_of_birth
Revises: 0001_initial
Create Date: 2026-05-09 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '0002_add_date_of_birth'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add date_of_birth column to users table
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))


def downgrade() -> None:
    # Remove date_of_birth column
    op.drop_column('users', 'date_of_birth')
