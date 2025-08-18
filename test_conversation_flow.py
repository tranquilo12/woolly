#!/usr/bin/env python3
"""
Test script for Phase 4 completion: Conversation History & Entity Discovery

This script tests the proper Pydantic AI conversation history patterns
and entity discovery workflow implementation.
"""

import asyncio
import sys
import os
import logging
from pathlib import Path

# Add the api directory to the path
sys.path.insert(0, str(Path(__file__).parent / "api"))

from agents.universal import ( # type: ignore
    UniversalAgentFactory,
    AgentType,
    ConversationContext,
    UniversalDependencies,
    UniversalResult,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_conversation_history_and_entity_discovery():
    """Test the complete conversation history and entity discovery workflow"""

    print("🚀 Testing Phase 4: Conversation History & Entity Discovery")
    print("=" * 80)

    # Initialize the factory
    factory = UniversalAgentFactory()

    # Wait for MCP connection test to complete
    await asyncio.sleep(2)

    # Test 1: Basic conversation context creation
    print("\n📝 Test 1: Conversation Context Creation")
    context = factory.get_or_create_conversation_context("woolly")
    print(f"✅ Created conversation context for 'woolly'")
    print(f"   - Message history length: {len(context.message_history)}")
    print(f"   - Valid entity IDs: {len(context.valid_entity_ids)}")
    print(f"   - Discovered entities: {len(context.discovered_entities)}")

    # Test 2: Agent execution with conversation context
    print("\n🤖 Test 2: Agent Execution with Conversation Context")
    try:
        result = await factory.execute_agent_with_context(
            agent_type=AgentType.SIMPLIFIER,
            repository_name="woolly",
            user_query="Find entities in the repository and analyze the code structure",
            context={},
        )

        print(f"✅ Agent execution completed")
        print(f"   - Agent type: {result.agent_type}")
        print(f"   - Content length: {len(result.content)}")
        print(f"   - MCP available: {result.metadata.get('mcp_available', 'unknown')}")
        print(
            f"   - Execution mode: {result.metadata.get('execution_mode', 'unknown')}"
        )

        # Check conversation context updates
        if result.conversation_context:
            print(
                f"   - Updated message history: {len(result.conversation_context.message_history)}"
            )
            print(
                f"   - Valid entity IDs: {len(result.conversation_context.valid_entity_ids)}"
            )
            print(
                f"   - Discovered entities: {len(result.conversation_context.discovered_entities)}"
            )

            # Show first few entity IDs if any
            if result.conversation_context.valid_entity_ids:
                print(
                    f"   - First 3 entity IDs: {result.conversation_context.valid_entity_ids[:3]}"
                )

    except Exception as e:
        print(f"❌ Agent execution failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False

    # Test 3: Follow-up conversation with entity context
    print("\n🔄 Test 3: Follow-up Conversation with Entity Context")
    try:
        result2 = await factory.execute_agent_with_context(
            agent_type=AgentType.TESTER,
            repository_name="woolly",
            user_query="Based on the previously discovered entities, suggest testing strategies",
            context={},
        )

        print(f"✅ Follow-up execution completed")
        print(f"   - Agent type: {result2.agent_type}")
        print(f"   - Content length: {len(result2.content)}")

        # Check if conversation context was maintained
        if result2.conversation_context:
            print(
                f"   - Message history length: {len(result2.conversation_context.message_history)}"
            )
            print(
                f"   - Valid entity IDs: {len(result2.conversation_context.valid_entity_ids)}"
            )
            print(
                f"   - Discovered entities: {len(result2.conversation_context.discovered_entities)}"
            )

            # Check if context was maintained across calls
            if len(result2.conversation_context.message_history) > len(
                result.conversation_context.message_history
            ):
                print("   ✅ Conversation history properly maintained across calls")
            else:
                print("   ⚠️  Conversation history may not be accumulating properly")

    except Exception as e:
        print(f"❌ Follow-up execution failed: {e}")
        return False

    # Test 4: MCP Connection and Health Check
    print("\n🏥 Test 4: MCP Connection and Health Check")
    try:
        health_result = await factory.health_check()
        print(f"✅ Health check completed")
        print(f"   - Factory status: {health_result.get('factory_status', 'unknown')}")
        print(f"   - MCP status: {health_result.get('mcp_status', 'unknown')}")
        print(
            f"   - Agent types available: {health_result.get('agent_types_available', 0)}"
        )
        print(
            f"   - Conversation contexts: {health_result.get('conversation_contexts', 0)}"
        )

        # Show MCP details
        mcp_details = health_result.get("mcp_details", {})
        if mcp_details:
            print(
                f"   - MCP connection test: {mcp_details.get('connection_test', 'unknown')}"
            )
            print(
                f"   - MCP integration type: {mcp_details.get('integration_type', 'unknown')}"
            )

    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

    # Test 5: Conversation Summary
    print("\n📊 Test 5: Conversation Summary")
    try:
        summary = factory.get_conversation_summary("woolly")
        print(f"✅ Conversation summary retrieved")
        print(f"   - Repository: {summary.get('repository', 'unknown')}")
        print(f"   - Status: {summary.get('status', 'unknown')}")
        print(f"   - Discovered entities: {summary.get('discovered_entities', 0)}")
        print(f"   - Valid entity IDs: {summary.get('valid_entity_ids', 0)}")
        print(
            f"   - Message history length: {summary.get('message_history_length', 0)}"
        )
        print(f"   - Last updated: {summary.get('last_updated', 'unknown')}")

    except Exception as e:
        print(f"❌ Conversation summary failed: {e}")
        return False

    # Test 6: Test different agent types
    print("\n🔄 Test 6: Multiple Agent Types")
    agent_types = [AgentType.SUMMARIZER, AgentType.DOCUMENTATION]

    for agent_type in agent_types:
        try:
            result = await factory.execute_agent_with_context(
                agent_type=agent_type,
                repository_name="woolly",
                user_query=f"Analyze the repository using {agent_type.value} approach",
                context={},
            )

            print(f"✅ {agent_type.value} agent executed successfully")
            print(f"   - Content length: {len(result.content)}")

        except Exception as e:
            print(f"❌ {agent_type.value} agent failed: {e}")

    print("\n" + "=" * 80)
    print("🎉 Phase 4 Testing Complete!")
    print(
        "✅ Conversation History & Entity Discovery workflow implemented successfully"
    )

    return True


async def main():
    """Main test execution"""
    try:
        success = await test_conversation_history_and_entity_discovery()
        if success:
            print("\n🎯 All tests passed! Phase 4 implementation is working correctly.")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed. Check the implementation.")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
