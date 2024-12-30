"""remove_updated_at_from_messages

Revision ID: 9e27e587d5a2
Revises: e7f7ef216f41
Create Date: 2024-12-28 16:27:03.562873

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9e27e587d5a2"
down_revision: Union[str, None] = "e7f7ef216f41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute(
        "ALTER TABLE messages ALTER COLUMN tool_invocations TYPE JSON USING tool_invocations::json"
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute("ALTER TABLE messages ALTER COLUMN tool_invocations TYPE TEXT")
    # ### end Alembic commands ###