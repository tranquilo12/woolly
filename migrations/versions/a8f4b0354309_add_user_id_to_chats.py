"""add_user_id_to_chats

Revision ID: a8f4b0354309
Revises: 9e27e587d5a2
Create Date: 2024-12-30 15:39:45.041868

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a8f4b0354309"
down_revision: Union[str, None] = "9e27e587d5a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First ensure the column exists and is nullable
    op.alter_column("chats", "user_id", existing_type=sa.UUID(), nullable=True)

    # Drop the foreign key if it exists
    op.drop_constraint("chats_user_id_fkey", "chats", type_="foreignkey")


def downgrade() -> None:
    # Add back the foreign key
    op.create_foreign_key("chats_user_id_fkey", "chats", "users", ["user_id"], ["id"])
    # Make the column nullable again
    op.alter_column("chats", "user_id", existing_type=sa.UUID(), nullable=True)
