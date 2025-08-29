#!/bin/bash

# Woolly Backend API Test Script
# Tests all documented endpoints and displays results
# Usage: ./test-api-endpoints.sh

# set -e  # Exit on any error - commented out for better error handling

# Configuration
API_BASE="http://localhost:80"
CHAT_ID=""
MESSAGE_ID=""
AGENT_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Testing:${NC} $description"
    echo -e "${BLUE}$method $endpoint${NC}"
    
    if [ -n "$data" ]; then
        echo -e "${YELLOW}Data:${NC} $data"
        response=$(curl -s -X $method "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\nHTTP_STATUS:%{http_code}")
    else
        response=$(curl -s -X $method "$API_BASE$endpoint" \
            -w "\nHTTP_STATUS:%{http_code}")
    fi
    
    # Extract HTTP status and response body
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    if [ "$http_status" -ge 200 ] && [ "$http_status" -lt 300 ]; then
        print_success "Status: $http_status"
        echo -e "${GREEN}Response:${NC} $response_body" | jq '.' 2>/dev/null || echo "$response_body"
        return 0
    else
        print_error "Status: $http_status"
        echo -e "${RED}Response:${NC} $response_body"
        return 1
    fi
}

test_streaming_endpoint() {
    local endpoint=$1
    local data=$2
    local description=$3
    
    echo -e "\n${YELLOW}Testing Streaming:${NC} $description"
    echo -e "${BLUE}POST $endpoint${NC}"
    echo -e "${YELLOW}Data:${NC} $data"
    
    print_info "Streaming for 5 seconds..."
    timeout 5s curl -s -X POST "$API_BASE$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data" \
        --no-buffer | head -20
    
    print_success "Streaming test completed"
}

# Start testing
print_header "Woolly Backend API Test Suite"
echo "Testing API at: $API_BASE"

# 1. Health Checks
print_header "Health Checks"

test_endpoint "GET" "/api/health" "" "Basic health check"

test_endpoint "GET" "/api/agents/health" "" "Agent system health check"

test_endpoint "GET" "/api/v1/agents/health" "" "Universal agent system health check"

test_endpoint "GET" "/api/v1/triage/health" "" "Triage system health check"

# 2. Chat Management
print_header "Chat Management"

# Create a chat
print_info "Creating a new chat..."
if create_chat_response=$(test_endpoint "POST" "/api/chat/create" "" "Create new chat"); then
    CHAT_ID=$(echo "$create_chat_response" | jq -r '.id' 2>/dev/null || echo "")
    if [ -n "$CHAT_ID" ] && [ "$CHAT_ID" != "null" ]; then
        print_success "Created chat with ID: $CHAT_ID"
    else
        print_error "Failed to extract chat ID from response"
    fi
fi

# List chats
test_endpoint "GET" "/api/chats" "" "List all chats"

# Update chat title (if we have a chat ID)
if [ -n "$CHAT_ID" ]; then
    test_endpoint "PATCH" "/api/chat/$CHAT_ID/title" '{"title": "Test Chat from API Script"}' "Update chat title"
fi

# 3. Agent Management
print_header "Agent Management"

# Create an agent
print_info "Creating a test agent..."
agent_data='{
  "name": "Test Agent",
  "description": "A test agent created by the API test script",
  "system_prompt": "You are a helpful test agent.",
  "tools": ["execute_python_code"],
  "repository": "woolly"
}'

if create_agent_response=$(test_endpoint "POST" "/api/agents" "$agent_data" "Create new agent"); then
    AGENT_ID=$(echo "$create_agent_response" | jq -r '.id' 2>/dev/null || echo "")
    if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ]; then
        print_success "Created agent with ID: $AGENT_ID"
    else
        print_error "Failed to extract agent ID from response"
    fi
fi

# List agents
test_endpoint "GET" "/api/agents" "" "List all agents"

# Get specific agent (if we have an agent ID)
if [ -n "$AGENT_ID" ]; then
    test_endpoint "GET" "/api/agents/$AGENT_ID" "" "Get specific agent"
fi

# 4. Universal Agent System
print_header "Universal Agent System"

test_endpoint "GET" "/api/v1/agents/types" "" "Get available agent types"

# Test MCP connection
test_endpoint "GET" "/api/v1/agents/mcp/test" "" "Test MCP connection"

# Execute single agent (non-streaming)
single_agent_data='{
  "repository_name": "woolly",
  "user_query": "What is the main purpose of this codebase?",
  "agent_type": "documentation",
  "enable_streaming": false
}'

test_endpoint "POST" "/api/v1/agents/execute/single" "$single_agent_data" "Execute single agent (non-streaming)"

# Execute multiple agents (immediate)
multi_agent_data='{
  "repository_name": "woolly",
  "user_query": "Analyze the authentication system",
  "agent_types": ["simplifier", "documentation"],
  "run_in_background": false,
  "enable_streaming": false
}'

test_endpoint "POST" "/api/v1/agents/execute" "$multi_agent_data" "Execute multiple agents (immediate)"

# 5. Triage System
print_header "Triage System"

# Analyze query (no execution)
triage_analyze_data='{
  "repository_name": "woolly",
  "user_query": "How does the chat system work?",
  "user_context": {},
  "conversation_history": []
}'

test_endpoint "POST" "/api/v1/triage/analyze" "$triage_analyze_data" "Analyze query with triage"

# Execute triage
triage_execute_data='{
  "repository_name": "woolly",
  "user_query": "What are the main components of this application?",
  "user_context": {},
  "conversation_history": []
}'

test_endpoint "POST" "/api/v1/triage/execute" "$triage_execute_data" "Execute triage analysis"

# Get triage stats
test_endpoint "GET" "/api/v1/triage/stats" "" "Get triage statistics"

# 6. Message Management (if we have a chat)
if [ -n "$CHAT_ID" ]; then
    print_header "Message Management"
    
    # Create a message
    message_data='{
      "role": "user",
      "content": "Hello from the API test script!",
      "toolInvocations": [],
      "prompt_tokens": 10,
      "completion_tokens": 0,
      "total_tokens": 10
    }'
    
    if create_message_response=$(test_endpoint "POST" "/api/chat/$CHAT_ID/messages" "$message_data" "Create message"); then
        MESSAGE_ID=$(echo "$create_message_response" | jq -r '.id' 2>/dev/null || echo "")
        if [ -n "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
            print_success "Created message with ID: $MESSAGE_ID"
        else
            print_error "Failed to extract message ID from response"
        fi
    fi
    
    # Get messages
    test_endpoint "GET" "/api/chat/$CHAT_ID/messages" "" "Get chat messages"
    
    # Get agent messages
    test_endpoint "GET" "/api/chat/$CHAT_ID/agent/messages" "" "Get agent messages"
    
    # Update message model (if we have a message ID)
    if [ -n "$MESSAGE_ID" ]; then
        test_endpoint "PATCH" "/api/chat/$CHAT_ID/messages/$MESSAGE_ID/model" '{"model": "gpt-4o-mini"}' "Update message model"
    fi
fi

# 7. Streaming Endpoints
print_header "Streaming Endpoints"

# Test streaming demo
streaming_demo_data='{"prompt": "authentication system"}'
test_streaming_endpoint "/api/streaming/mock" "$streaming_demo_data" "Mock streaming demo"

# Test streaming format validation
test_endpoint "GET" "/api/streaming/test" "" "Streaming format validation"

# Test single agent streaming
single_agent_streaming_data='{
  "repository_name": "woolly",
  "user_query": "What is this codebase about?",
  "agent_type": "summarizer",
  "enable_streaming": true
}'

test_streaming_endpoint "/api/v1/agents/execute/single" "$single_agent_streaming_data" "Single agent streaming"

# 8. Error Statistics
print_header "Error Statistics & Diagnostics"

test_endpoint "GET" "/api/v1/agents/errors/statistics" "" "Get error statistics"

test_endpoint "POST" "/api/v1/agents/errors/reset" "" "Reset error statistics"

# 9. Chat Interaction (if we have a chat)
if [ -n "$CHAT_ID" ]; then
    print_header "Chat Interaction"
    
    # Test main chat endpoint with streaming
    chat_data='{
      "messages": [
        {
          "role": "user",
          "content": "What is 2 + 2?",
          "id": "test-msg-1"
        }
      ],
      "model": "gpt-4o"
    }'
    
    test_streaming_endpoint "/api/chat/$CHAT_ID" "$chat_data" "Main chat endpoint streaming"
fi

# 10. Cleanup (optional)
print_header "Cleanup"

# Delete test message (if we have one)
if [ -n "$CHAT_ID" ] && [ -n "$MESSAGE_ID" ]; then
    test_endpoint "DELETE" "/api/chat/$CHAT_ID/messages/$MESSAGE_ID" "" "Delete test message"
fi

# Delete test agent (if we have one)
if [ -n "$AGENT_ID" ]; then
    test_endpoint "DELETE" "/api/agents/$AGENT_ID" "" "Delete test agent"
fi

# Delete test chat (if we have one)
if [ -n "$CHAT_ID" ]; then
    test_endpoint "DELETE" "/api/chat/$CHAT_ID" "" "Delete test chat"
fi

print_header "Test Suite Complete"
print_success "All endpoint tests completed!"
print_info "Check the output above for any failed tests."
print_info "Streaming tests were limited to 5 seconds each for demonstration."

echo -e "\n${BLUE}Summary:${NC}"
echo "- Tested health checks for all systems"
echo "- Tested CRUD operations for chats, messages, and agents"
echo "- Tested universal agent system execution"
echo "- Tested triage system analysis and execution"
echo "- Tested streaming endpoints with timeouts"
echo "- Tested error statistics and diagnostics"
echo "- Cleaned up test resources"
