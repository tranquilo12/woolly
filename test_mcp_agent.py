#!/usr/bin/env python3
"""
Test script to verify MCP agent integration with conversation context and tool call interception
"""

import asyncio
import sys
import os

sys.path.append(".")

from api.agents.universal import get_universal_factory, AgentType


async def test_conversation_context():
    """Test conversation context and tool call interception"""
    print(
        "🔧 Testing MCP Agent with Conversation Context and Tool Call Interception..."
    )

    factory = get_universal_factory()

    # Test 1: Basic health check
    print("\n1️⃣ Testing basic health check...")
    try:
        health = await factory.health_check()
        print(f"✅ Health check result: {health['factory_status']}")
        print(f"   MCP Status: {health['mcp_status']}")
        print(f"   Agent Types: {len(health['agent_types'])}")
        print(f"   Conversation Contexts: {health['conversation_contexts']}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")

    # Test 2: Test conversation context creation
    print("\n2️⃣ Testing conversation context creation...")
    try:
        # First interaction - should create context
        result1 = await factory.execute_agent_with_context(
            AgentType.SIMPLIFIER,
            "code-indexing-service",
            "Discover entities in this repository and analyze the structure",
            {"analysis_type": "entity_discovery"},
        )
        print(f"✅ First interaction successful!")
        print(f"   Agent Type: {result1.agent_type}")
        print(f"   Content Length: {len(result1.content)} characters")
        print(
            f"   Context Entities: {result1.metadata.get('conversation_context_entities', 0)}"
        )
        print(f"   Valid Entity IDs: {result1.metadata.get('valid_entity_ids', 0)}")
        print(
            f"   History Length: {result1.metadata.get('conversation_history_length', 0)}"
        )

        # Check conversation context
        if result1.conversation_context:
            print(
                f"   Discovered Entities: {len(result1.conversation_context.discovered_entities)}"
            )
            print(f"   Valid IDs: {len(result1.conversation_context.valid_entity_ids)}")
            print(
                f"   History Messages: {len(result1.conversation_context.conversation_history)}"
            )

        # Second interaction - should use existing context
        print(f"\n   Second interaction using existing context...")
        result2 = await factory.execute_agent_with_context(
            AgentType.SIMPLIFIER,
            "code-indexing-service",
            "Now analyze relationships between the entities you discovered",
            {"analysis_type": "relationship_analysis"},
        )
        print(f"✅ Second interaction successful!")
        print(
            f"   Context Entities: {result2.metadata.get('conversation_context_entities', 0)}"
        )
        print(f"   Valid Entity IDs: {result2.metadata.get('valid_entity_ids', 0)}")
        print(
            f"   History Length: {result2.metadata.get('conversation_history_length', 0)}"
        )

        # Check if context was preserved and expanded
        if result2.conversation_context:
            print(
                f"   Context Growth - Entities: {len(result2.conversation_context.discovered_entities)}"
            )
            print(
                f"   Context Growth - Valid IDs: {len(result2.conversation_context.valid_entity_ids)}"
            )
            print(
                f"   Context Growth - History: {len(result2.conversation_context.conversation_history)}"
            )

            # Show some message types in history
            message_types = [
                type(msg).__name__
                for msg in result2.conversation_context.conversation_history[-5:]
            ]
            print(f"   Recent Message Types: {message_types}")

    except Exception as e:
        print(f"❌ Conversation context test failed: {e}")
        import traceback

        traceback.print_exc()

    # Test 3: Test context summary
    print("\n3️⃣ Testing conversation context summary...")
    try:
        summary = factory.get_conversation_summary("code-indexing-service")
        print(f"✅ Context summary retrieved:")
        for key, value in summary.items():
            print(f"   {key}: {value}")
    except Exception as e:
        print(f"❌ Context summary failed: {e}")

    # Test 4: Test multiple repositories
    print("\n4️⃣ Testing multiple repository contexts...")
    try:
        # Test with woolly repository
        result_woolly = await factory.execute_agent_with_context(
            AgentType.DOCUMENTATION,
            "woolly",
            "Analyze the agent system architecture in this repository",
            {"focus": "architecture"},
        )
        print(f"✅ Woolly repository context created!")
        print(f"   Content Length: {len(result_woolly.content)} characters")

        # Check that we now have multiple contexts
        health_after = await factory.health_check()
        print(f"   Total Contexts: {health_after['conversation_contexts']}")
        print(f"   Context Repos: {list(health_after['context_summaries'].keys())}")

    except Exception as e:
        print(f"❌ Multiple repository test failed: {e}")

    # Test 5: Test context clearing
    print("\n5️⃣ Testing context clearing...")
    try:
        # Clear one context
        factory.clear_conversation_context("code-indexing-service")

        # Check that context was cleared
        health_after_clear = await factory.health_check()
        print(f"✅ Context cleared!")
        print(f"   Remaining Contexts: {health_after_clear['conversation_contexts']}")
        print(
            f"   Remaining Repos: {list(health_after_clear['context_summaries'].keys())}"
        )

    except Exception as e:
        print(f"❌ Context clearing test failed: {e}")

    # Test 6: Test tool call interception (if we can inspect the history)
    print("\n6️⃣ Testing tool call interception...")
    try:
        # Create a new context and make a query that should trigger MCP tools
        result_tools = await factory.execute_agent_with_context(
            AgentType.TESTER,
            "unified-mcp-server",
            "Find entities in this repository and analyze their test coverage",
            {"analysis_type": "test_coverage"},
        )
        print(f"✅ Tool call interception test completed!")
        print(f"   Content Length: {len(result_tools.content)} characters")

        if result_tools.conversation_context:
            history = result_tools.conversation_context.conversation_history
            print(f"   Total Messages: {len(history)}")

            # Count different message types
            message_type_counts = {}
            for msg in history:
                msg_type = type(msg).__name__
                message_type_counts[msg_type] = message_type_counts.get(msg_type, 0) + 1

            print(f"   Message Type Breakdown:")
            for msg_type, count in message_type_counts.items():
                print(f"     {msg_type}: {count}")

    except Exception as e:
        print(f"❌ Tool call interception test failed: {e}")
        import traceback

        traceback.print_exc()


async def test_entity_discovery_flow():
    """Test the specific entity discovery flow that was failing"""
    print("\n🔍 Testing Entity Discovery Flow...")

    factory = get_universal_factory()

    try:
        # Test entity discovery with explicit instructions
        result = await factory.execute_agent_with_context(
            AgentType.SIMPLIFIER,
            "code-indexing-service",
            "First, discover available entities using find_entities, then analyze relationships for valid entity IDs only. Do not use hardcoded UUIDs.",
            {"analysis_type": "entity_discovery_flow"},
        )

        print(f"✅ Entity discovery flow completed!")
        print(f"   Content Length: {len(result.content)} characters")
        print(
            f"   Valid Entity IDs Found: {result.metadata.get('valid_entity_ids', 0)}"
        )

        # Show content preview
        content_preview = (
            result.content[:300] + "..."
            if len(result.content) > 300
            else result.content
        )
        print(f"   Content Preview: {content_preview}")

        # Show discovered entities
        if result.conversation_context and result.conversation_context.valid_entity_ids:
            print(f"   First 5 Valid Entity IDs:")
            for i, entity_id in enumerate(
                result.conversation_context.valid_entity_ids[:5]
            ):
                print(f"     {i+1}. {entity_id}")

    except Exception as e:
        print(f"❌ Entity discovery flow failed: {e}")
        import traceback

        traceback.print_exc()


async def main():
    """Main test execution"""
    print("🚀 Starting Comprehensive MCP Agent Context Tests...")

    await test_conversation_context()
    await test_entity_discovery_flow()

    print("\n🎉 All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
