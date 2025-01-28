import pytest
import os


@pytest.fixture(autouse=True)
def setup_test_env():
    os.environ["OPENAI_API_KEY"] = "test-key"
