"""adding_agents

Revision ID: fc27d26eb999
Revises: 3dda4dbdf265
Create Date: 2025-01-02 13:54:30.080820

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "fc27d26eb999"
down_revision: Union[str, None] = "3dda4dbdf265"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table exists
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    # Create agents table if it doesn't exist
    if "agents" not in tables:
        op.create_table(
            "agents",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("system_prompt", sa.Text(), nullable=True),
            sa.Column("tools", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )

    # Check if column exists in chats table
    chat_columns = [c["name"] for c in inspector.get_columns("chats")]
    if "agent_id" not in chat_columns:
        op.add_column("chats", sa.Column("agent_id", sa.UUID(), nullable=True))
        op.create_foreign_key(None, "chats", "agents", ["agent_id"], ["id"])

    # Check if column exists in users table
    user_columns = [c["name"] for c in inspector.get_columns("users")]
    if "hashed_password" not in user_columns:
        op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=True))

    # Only drop if these columns/indexes exist
    if "azure_id" in user_columns:
        op.drop_index("ix_users_azure_id", table_name="users")
        op.drop_column("users", "azure_id")
    if "refresh_token" in user_columns:
        op.drop_column("users", "refresh_token")
    if "access_token" in user_columns:
        op.drop_column("users", "access_token")
    if "token_expires_at" in user_columns:
        op.drop_column("users", "token_expires_at")
    if "updated_at" in user_columns:
        op.drop_column("users", "updated_at")
    if "name" in user_columns:
        op.drop_column("users", "name")


def downgrade() -> None:
    op.drop_table("agents")
    op.add_column(
        "users", sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "token_expires_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "users", sa.Column("azure_id", sa.VARCHAR(), autoincrement=False, nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("access_token", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("refresh_token", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.create_index("ix_users_azure_id", "users", ["azure_id"], unique=True)
    op.drop_column("users", "hashed_password")
    op.drop_constraint(None, "chats", type_="foreignkey")
    op.drop_column("chats", "agent_id")
