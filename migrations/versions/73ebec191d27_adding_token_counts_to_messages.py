"""adding_token_counts_to_messages

Revision ID: 73ebec191d27
Revises: fc27d26eb999
Create Date: 2025-01-09 11:50:48.072530

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "73ebec191d27"
down_revision: Union[str, None] = "fc27d26eb999"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns exist
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("messages")]

    if "prompt_tokens" not in columns:
        op.add_column(
            "messages", sa.Column("prompt_tokens", sa.Integer(), nullable=True)
        )
    if "completion_tokens" not in columns:
        op.add_column(
            "messages", sa.Column("completion_tokens", sa.Integer(), nullable=True)
        )
    if "total_tokens" not in columns:
        op.add_column(
            "messages", sa.Column("total_tokens", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("messages", "total_tokens")
    op.drop_column("messages", "completion_tokens")
    op.drop_column("messages", "prompt_tokens")
