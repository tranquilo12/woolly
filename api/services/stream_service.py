import json
from typing import List
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from sqlalchemy.orm import Session
from uuid import UUID
from openai import OpenAI
import os
from fastapi.responses import StreamingResponse

from ..utils.models import (
    Message,
    build_tool_call_partial,
    build_tool_call_result,
    is_complete_json,
)
from ..utils.tools import execute_python_code

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

available_tools = {
    "execute_python_code": execute_python_code,
}


def do_stream(messages: List[ChatCompletionMessageParam], model: str = "gpt-4o"):
    formatted_messages = []

    for msg in messages:
        if isinstance(msg, dict) and msg.get("experimental_attachments"):
            attachments = msg["experimental_attachments"]
            content = [
                {"type": "text", "text": msg.get("content", "")},
            ]

            for attachment in attachments:
                if attachment.get("contentType", "").startswith("image/"):
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": attachment["url"], "detail": "auto"},
                        }
                    )

            formatted_messages.append({"role": msg["role"], "content": content})
        else:
            formatted_messages.append(msg)

    stream = client.chat.completions.create(
        messages=formatted_messages,
        model=model,
        stream=True,
        stream_options={"include_usage": True},
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "execute_python_code",
                    "description": "Execute Python code",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {
                                "type": "string",
                                "description": "The Python code to execute",
                            },
                            "output_format": {
                                "type": "string",
                                "description": "The format of the output",
                            },
                        },
                        "required": ["code", "output_format"],
                    },
                },
            }
        ],
    )

    return stream


def get_streaming_headers():
    """Helper function to ensure consistent streaming headers"""
    return {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "x-vercel-ai-data-stream": "v1",
    }


def stream_text(
    messages: List[ChatCompletionMessageParam],
    protocol: str = "data",
    model: str = "gpt-4o",
    db: Session = None,
    message_id: UUID = None,
):
    stream = do_stream(messages, model=model)
    content_buffer = ""
    final_usage = None
    draft_tool_calls = []
    tool_invocations = []
    draft_tool_calls_index = -1

    for chunk in stream:
        for choice in chunk.choices:
            if choice.delta.tool_calls:
                for tool_call in choice.delta.tool_calls:
                    id = tool_call.id
                    name = tool_call.function.name if tool_call.function else None
                    arguments = (
                        tool_call.function.arguments if tool_call.function else None
                    )

                    if id is not None:
                        draft_tool_calls_index += 1
                        draft_tool_calls.append(
                            {"id": id, "name": name, "arguments": "{}"}
                        )
                        yield build_tool_call_partial(
                            tool_call_id=id,
                            tool_name=name,
                            args={},
                        )
                    elif arguments:
                        try:
                            current_args = draft_tool_calls[draft_tool_calls_index][
                                "arguments"
                            ]
                            draft_tool_calls[draft_tool_calls_index]["arguments"] = (
                                current_args.rstrip("}") + arguments.lstrip("{")
                            )

                            if is_complete_json(
                                draft_tool_calls[draft_tool_calls_index]["arguments"]
                            ):
                                parsed_args = json.loads(
                                    draft_tool_calls[draft_tool_calls_index][
                                        "arguments"
                                    ]
                                )
                                yield build_tool_call_partial(
                                    tool_call_id=draft_tool_calls[
                                        draft_tool_calls_index
                                    ]["id"],
                                    tool_name=draft_tool_calls[draft_tool_calls_index][
                                        "name"
                                    ],
                                    args=parsed_args,
                                )
                        except json.JSONDecodeError:
                            continue

            elif choice.finish_reason == "tool_calls":
                for tool_call in draft_tool_calls:
                    try:
                        parsed_args = json.loads(tool_call["arguments"])
                        tool_result = available_tools[tool_call["name"]](**parsed_args)

                        tool_invocations.append(
                            {
                                "id": tool_call["id"],
                                "toolName": tool_call["name"],
                                "args": parsed_args,
                                "result": tool_result,
                                "state": "result",
                            }
                        )

                        yield build_tool_call_result(
                            tool_call_id=tool_call["id"],
                            tool_name=tool_call["name"],
                            args=parsed_args,
                            result=tool_result,
                        )
                    except Exception as e:
                        print(f"Tool execution error: {e}")
                        error_result = {"error": str(e)}

                        # Ensure error state is properly saved
                        tool_invocations.append(
                            {
                                "id": tool_call["id"],
                                "toolName": tool_call["name"],
                                "args": (
                                    json.loads(tool_call["arguments"])
                                    if is_complete_json(tool_call["arguments"])
                                    else {}
                                ),
                                "result": error_result,
                                "state": "error",
                            }
                        )

                        yield build_tool_call_result(
                            tool_call_id=tool_call["id"],
                            tool_name=tool_call["name"],
                            args=(
                                json.loads(tool_call["arguments"])
                                if is_complete_json(tool_call["arguments"])
                                else {}
                            ),
                            result=error_result,
                        )

            else:
                content = choice.delta.content or ""
                content_buffer += content
                yield f"0:{json.dumps(content)}\n"

        if chunk.choices == []:
            usage = chunk.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens
            final_usage = usage

            yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion},"totalTokens":{total}}},"isContinued":false}}\n'.format(
                reason="stop",
                prompt=prompt_tokens,
                completion=completion_tokens,
                total=prompt_tokens + completion_tokens,
            )

    if final_usage and db and message_id:
        try:
            message = db.query(Message).filter(Message.id == message_id).first()
            if message:
                message.content = content_buffer
                message.prompt_tokens = final_usage.prompt_tokens
                message.completion_tokens = final_usage.completion_tokens
                message.total_tokens = (
                    final_usage.prompt_tokens + final_usage.completion_tokens
                )
                message.tool_invocations = tool_invocations
                db.commit()
        except Exception as e:
            print(f"Failed to update message: {e}")

    # Return with standardized headers
    return StreamingResponse(
        stream_text(messages, protocol, model, db, message_id),
        headers=get_streaming_headers(),
    )
