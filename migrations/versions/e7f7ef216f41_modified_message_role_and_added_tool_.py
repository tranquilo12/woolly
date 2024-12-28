"""Modified message role and added tool_invocations

Revision ID: e7f7ef216f41
Revises: 6f60e3073c20
Create Date: 2024-12-27 23:51:43.365204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f7ef216f41'
down_revision: Union[str, None] = '6f60e3073c20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('messages', sa.Column('tool_invocations', sa.Text(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('messages', 'tool_invocations')
    # ### end Alembic commands ###