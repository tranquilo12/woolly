from pydantic_ai import ChatHistory, SystemMessage, UserMessage, AssistantMessage
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class DocumentationSystemMessage(SystemMessage):
    """System message with repository context"""

    repo_name: str
    file_paths: Optional[List[str]]


class DocumentationUserMessage(UserMessage):
    """User message requesting documentation"""

    repo_name: str
    context: Optional[str]


class DocumentationAssistantMessage(AssistantMessage):
    """Assistant message with documentation plan"""

    plan: str
    file_paths: List[str]


class DocumentationChatHistory(ChatHistory):
    """Chat history for documentation generation"""

    messages: List[SystemMessage | UserMessage | AssistantMessage]
    repo_name: str
