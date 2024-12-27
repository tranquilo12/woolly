import os
import json
from time import timezone
from typing import List
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import get_current_weather, execute_python_code
from .utils.models import (
    build_end_of_stream_message,
    build_tool_call_instruction,
    build_tool_call_result,
    Chat,
    Message,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from datetime import datetime


load_dotenv(".env.local")

app = FastAPI()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class Request(BaseModel):
    messages: List[ClientMessage]


available_tools = {
    "get_current_weather": get_current_weather,
    "execute_python_code": execute_python_code,
}


def do_stream(messages: List[ChatCompletionMessageParam]):
    stream = client.chat.completions.create(
        messages=messages,
        model="gpt-4o",
        stream=True,
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "get_current_weather",
                    "description": "Get the current weather at a location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "latitude": {
                                "type": "number",
                                "description": "The latitude of the location",
                            },
                            "longitude": {
                                "type": "number",
                                "description": "The longitude of the location",
                            },
                        },
                        "required": ["latitude", "longitude"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_python_code",
                    "description": "Execute Python code and return the output",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "string"},
                            "output_format": {"type": "string"},
                            "timeout": {"type": "number"},
                        },
                        "required": ["code", "output_format"],
                    },
                },
            },
        ],
    )

    return stream


def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = "data"):
    draft_tool_calls = []
    draft_tool_calls_index = -1

    stream = client.chat.completions.create(
        messages=messages,
        model="gpt-4o",
        stream=True,
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "get_current_weather",
                    "description": "Get the current weather at a location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "latitude": {
                                "type": "number",
                                "description": "The latitude of the location",
                            },
                            "longitude": {
                                "type": "number",
                                "description": "The longitude of the location",
                            },
                        },
                        "required": ["latitude", "longitude"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_python_code",
                    "description": "Execute Python code and return the output",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "string"},
                            "output_format": {"type": "string"},
                            "timeout": {"type": "number"},
                        },
                        "required": ["code", "output_format"],
                    },
                },
            },
        ],
    )

    for chunk in stream:
        for choice in chunk.choices:
            if choice.finish_reason == "stop":
                continue

            elif choice.finish_reason == "tool_calls":
                for tool_call in draft_tool_calls:
                    yield build_tool_call_instruction(
                        tool_call["id"],
                        tool_call["name"],
                        json.loads(tool_call["arguments"]),
                    )

                for tool_call in draft_tool_calls:
                    tool_result = available_tools[tool_call["name"]](
                        **json.loads(tool_call["arguments"])
                    )

                    yield build_tool_call_result(
                        tool_call["id"],
                        tool_call["name"],
                        json.loads(tool_call["arguments"]),
                        tool_result,
                    )

            elif choice.delta.tool_calls:
                for tool_call in choice.delta.tool_calls:
                    if tool_call.id is not None:
                        draft_tool_calls_index += 1
                        draft_tool_calls.append(
                            {
                                "id": tool_call.id,
                                "name": tool_call.function.name,
                                "arguments": "",
                            }
                        )
                    else:
                        draft_tool_calls[draft_tool_calls_index][
                            "arguments"
                        ] += tool_call.function.arguments

            else:
                yield "0:{text}\n".format(text=json.dumps(choice.delta.content))

        if chunk.choices == []:
            yield build_end_of_stream_message(
                "tool-calls" if len(draft_tool_calls) > 0 else "stop",
                chunk.usage.prompt_tokens,
                chunk.usage.completion_tokens,
            )


@app.post("/api/chat")
async def handle_chat_legacy(request: Request, protocol: str = Query("data")):
    """Legacy endpoint maintained for backward compatibility"""
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers["x-vercel-ai-data-stream"] = "v1"
    return response


@app.post("/api/chat/{chat_id}")
async def handle_chat_with_storage(
    chat_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    protocol: str = Query("data"),
):
    """New endpoint that includes database storage"""
    # Verify chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    # Store incoming message
    user_message = Message(
        chat_id=chat_id,
        role="user",
        content=messages[-1].content if messages else "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_message)
    db.commit()

    # Use existing streaming functionality
    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers["x-vercel-ai-data-stream"] = "v1"

    # Update chat's updated_at timestamp
    chat.updated_at = datetime.now(timezone.utc)
    db.commit()

    return response
