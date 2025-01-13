from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from ..utils.prompt import Attachment


class ToolInvocation(BaseModel):
    id: str
    function: Optional[dict] = None
    toolName: Optional[str] = None
    args: Optional[dict] = None
    state: str
    result: Optional[dict] = None


class ClientMessageWithTools(BaseModel):
    role: str
    content: str
    id: Optional[str] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
    model: Optional[str] = None
    experimental_attachments: Optional[List[Attachment]] = None


class RequestFromFrontend(BaseModel):
    messages: List[ClientMessageWithTools]
    model: Optional[str] = "gpt-4o"
    agent_id: Optional[str] = None
