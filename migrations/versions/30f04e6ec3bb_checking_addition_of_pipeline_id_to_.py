"""checking_addition_of_pipeline_id_to_messages

Revision ID: 30f04e6ec3bb
Revises: add_pipeline_id_to_messages
Create Date: 2025-03-06 20:55:59.791698

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30f04e6ec3bb'
down_revision: Union[str, None] = 'add_pipeline_id_to_messages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
