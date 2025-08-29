# FastMCP Client Connection Guide: Unified MCP Server

**Date:** 2025-01-12  
**Version:** 1.0  
**Author(s):** Development Team  
**Related System:** FastMCP 2.10.0 Unified MCP Server  
**Server Endpoint:** `localhost:8009/sse/` (Streamable HTTP Transport)  
**Status:** Approved ✅

## 1. Introduction

### Purpose
This document provides the **definitive guide** for connecting to our FastMCP Unified MCP Server using FastMCP 2.10.0 client best practices. It serves as the authoritative reference for developers implementing MCP clients that need to interact with our code indexing and analysis services.

### Goals of This Guide
- **Establish Standard Connection Patterns:** Provide tested, working code examples for FastMCP client connections
- **Clarify Transport Configuration:** Resolve confusion between SSE endpoint naming and actual Streamable HTTP transport
- **Enable Rapid Integration:** Allow any team to quickly connect to our MCP server with minimal setup
- **Demonstrate Best Practices:** Showcase proper async patterns, error handling, and response processing
- **Provide Rich Context:** Include comprehensive examples that can be copy-pasted into any conversation or codebase

## 2. Server Overview & Architecture

### 2.1. Server Details

| Property | Value | Description |
|:---------|:------|:------------|
| **Server Name** | `unified-mcp-server-v2` | FastMCP server instance name |
| **Host** | `localhost` | Server hostname |
| **Port** | `8009` | Server port |
| **Path** | `/sse/` | Endpoint path (confusing name!) |
| **Transport Type** | **Streamable HTTP** | Actual transport protocol |
| **FastMCP Version** | 2.9/2.10 Compatible | Server implementation version |
| **Client Version** | FastMCP 2.10.0+ | Recommended client version |

### 2.2. Transport Clarification ⚠️

**IMPORTANT:** Despite the `/sse/` path name, this server uses **Streamable HTTP transport**, NOT SSE transport!

```python
# ❌ WRONG - This will fail with 400 Bad Request
config = {
    "mcpServers": {
        "my_server": {
            "transport": "sse",  # Wrong transport type
            "url": "http://localhost:8009/sse/"
        }
    }
}

# ✅ CORRECT - Use "http" transport for Streamable HTTP
config = {
    "mcpServers": {
        "my_server": {
            "transport": "http",  # Correct transport type
            "url": "http://localhost:8009/sse/"
        }
    }
}
```

### 2.3. Available Capabilities

The server exposes **14 powerful tools** for code analysis and repository management:

| Tool Category | Tools | Description |
|:--------------|:------|:------------|
| **Code Analysis** | `qa_codebase`, `search_code`, `find_entities`, `get_entity_relationships` | Semantic code search and analysis |
| **Repository Management** | `repo_list_indexed`, `repo_get_info`, `get_indexing_status`, `start_repo_indexing` | Repository indexing and status |
| **System Health** | `health_check`, `test_progress_reporting`, `test_sse_connection` | Server monitoring and testing |
| **Cache Management** | `clear_repository_cache`, `clear_all_caches` | Data cache management |
| **Visualization** | `generate_diagram` | Mermaid diagram generation |

## 3. Client Implementation Strategy

### 3.1. Recommended Approach

Based on [FastMCP Client documentation](https://gofastmcp.com/clients/client), we recommend:

1. **Configuration-Based Clients:** Use MCP configuration dictionaries for maximum compatibility
2. **Async Context Management:** Always use `async with client:` pattern
3. **Proper Error Handling:** Handle different response formats gracefully
4. **Transport Specification:** Explicitly specify `"http"` transport for our Streamable HTTP server

### 3.2. Client Architecture Pattern

```python
from fastmcp import Client
import asyncio

# Configuration-based client (recommended)
config = {
    "mcpServers": {
        "unified_server": {
            "transport": "http",
            "url": "http://localhost:8009/sse/"
        }
    }
}

async def mcp_interaction():
    client = Client(config)
    
    async with client:  # Proper lifecycle management
        # Your MCP operations here
        await client.ping()
        tools = await client.list_tools()
        # ... more operations
```

## 4. Implementation Examples

### 4.1. Basic Connection Example

**File:** `basic_mcp_client.py`

```python
#!/usr/bin/env python3
"""
Basic FastMCP Client Example
===========================

Demonstrates minimal working connection to the Unified MCP Server.
This is the fastest way to get started with our MCP server.
"""

import asyncio
import sys
from fastmcp import Client

async def basic_connection_test():
    """Minimal example showing working connection pattern."""
    
    # ✅ CORRECT: Use "http" transport for Streamable HTTP server
    config = {
        "mcpServers": {
            "unified_server": {
                "transport": "http",
                "url": "http://localhost:8009/sse/"
            }
        }
    }
    
    client = Client(config)
    
    try:
        async with client:
            print("🔌 Connected to Unified MCP Server!")
            
            # Test connectivity
            await client.ping()
            print("✅ Server ping successful!")
            
            # List available tools
            tools = await client.list_tools()
            tools_list = tools.tools if hasattr(tools, 'tools') else tools
            print(f"🛠️  Found {len(tools_list)} tools available")
            
            # Test a simple tool
            result = await client.call_tool("health_check", {})
            print(f"🏥 Health check result: {result}")
            
            return True
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(basic_connection_test())
    sys.exit(0 if success else 1)
```

### 4.2. Comprehensive Client Example

**File:** `comprehensive_mcp_client.py`

```python
#!/usr/bin/env python3
"""
Comprehensive FastMCP Client Example
===================================

Demonstrates all major patterns for interacting with the Unified MCP Server.
Use this as a reference for building production MCP clients.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastmcp import Client
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.panel import Panel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
console = Console()

class UnifiedMCPClient:
    """
    Production-ready MCP client for the Unified MCP Server.
    
    Demonstrates best practices for:
    - Connection management
    - Error handling
    - Tool execution
    - Response processing
    - Progress reporting
    """
    
    def __init__(self, server_url: str = "http://localhost:8009/sse/"):
        """Initialize the MCP client with proper configuration."""
        self.server_url = server_url
        self.config = {
            "mcpServers": {
                "unified_server": {
                    "transport": "http",  # Critical: Use "http" not "sse"
                    "url": server_url
                }
            }
        }
        self.client = Client(self.config)
        self.connection_info = {}
    
    async def connect_and_verify(self) -> bool:
        """Establish connection and verify server capabilities."""
        try:
            console.print("🔧 Initializing connection to Unified MCP Server...")
            
            async with self.client as client:
                # Test basic connectivity
                await client.ping()
                console.print("✅ Server ping successful!")
                
                # Store connection metadata
                self.connection_info = {
                    'server_url': self.server_url,
                    'connected_at': datetime.now().isoformat(),
                    'client_version': '2.10.0',
                    'transport': 'Streamable HTTP',
                    'status': 'connected'
                }
                
                return True
                
        except Exception as e:
            console.print(f"❌ Connection failed: {e}")
            logger.error(f"Connection error: {e}")
            return False
    
    async def discover_capabilities(self) -> Dict[str, Any]:
        """Discover and catalog all server capabilities."""
        capabilities = {
            'tools': [],
            'resources': [],
            'prompts': [],
            'discovery_time': datetime.now().isoformat()
        }
        
        try:
            console.print("🔍 Discovering server capabilities...")
            
            async with self.client as client:
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    console=console
                ) as progress:
                    
                    # Discover tools
                    task = progress.add_task("Discovering tools...", total=None)
                    tools = await client.list_tools()
                    tools_list = tools.tools if hasattr(tools, 'tools') else tools
                    
                    capabilities['tools'] = [
                        {
                            'name': tool.name,
                            'description': tool.description[:100] + "..." if len(tool.description) > 100 else tool.description,
                            'input_schema': tool.inputSchema.model_dump() if hasattr(tool, 'inputSchema') and tool.inputSchema else None
                        }
                        for tool in tools_list
                    ]
                    progress.update(task, description=f"✅ Found {len(capabilities['tools'])} tools")
                    
                    # Discover resources
                    task2 = progress.add_task("Discovering resources...", total=None)
                    resources = await client.list_resources()
                    resources_list = resources.resources if hasattr(resources, 'resources') else resources
                    
                    capabilities['resources'] = [
                        {
                            'uri': resource.uri,
                            'name': getattr(resource, 'name', 'Unknown'),
                            'description': getattr(resource, 'description', 'No description'),
                            'mimeType': getattr(resource, 'mimeType', 'unknown')
                        }
                        for resource in resources_list
                    ]
                    progress.update(task2, description=f"✅ Found {len(capabilities['resources'])} resources")
            
            return capabilities
            
        except Exception as e:
            console.print(f"❌ Capability discovery failed: {e}")
            logger.error(f"Discovery error: {e}")
            return capabilities
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Execute a tool with proper error handling and response processing.
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments (default: empty dict)
            
        Returns:
            Dict containing execution results and metadata
        """
        if arguments is None:
            arguments = {}
            
        execution_result = {
            'tool_name': tool_name,
            'arguments': arguments,
            'success': False,
            'result': None,
            'error': None,
            'execution_time': datetime.now().isoformat()
        }
        
        try:
            console.print(f"🔧 Executing tool: {tool_name}")
            
            async with self.client as client:
                result = await client.call_tool(tool_name, arguments)
                
                # Handle different response formats
                if hasattr(result, 'content') and result.content:
                    execution_result['result'] = result.content[0].text
                elif isinstance(result, list) and result:
                    execution_result['result'] = result[0].text if hasattr(result[0], 'text') else str(result[0])
                else:
                    execution_result['result'] = str(result)
                
                execution_result['success'] = True
                console.print(f"✅ Tool executed successfully")
                
        except Exception as e:
            execution_result['error'] = str(e)
            console.print(f"❌ Tool execution failed: {e}")
            logger.error(f"Tool {tool_name} execution error: {e}")
        
        return execution_result
    
    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run a comprehensive test of server capabilities."""
        test_results = {
            'connection': None,
            'capabilities': None,
            'tool_tests': [],
            'test_completed_at': datetime.now().isoformat()
        }
        
        console.print(Panel.fit(
            "FastMCP Unified Server Comprehensive Test\n"
            f"Target: {self.server_url}\n"
            "Testing all major capabilities and tools",
            title="🚀 MCP CLIENT TEST SUITE",
            border_style="bold blue"
        ))
        
        # Test connection
        test_results['connection'] = await self.connect_and_verify()
        if not test_results['connection']:
            return test_results
        
        # Discover capabilities
        test_results['capabilities'] = await self.discover_capabilities()
        
        # Test key tools
        key_tools = [
            ('health_check', {}),
            ('repo_list_indexed', {}),
            ('test_sse_connection', {'message': 'Test from comprehensive client'})
        ]
        
        for tool_name, args in key_tools:
            result = await self.execute_tool(tool_name, args)
            test_results['tool_tests'].append(result)
        
        # Display results
        self._display_test_results(test_results)
        
        return test_results
    
    def _display_test_results(self, results: Dict[str, Any]):
        """Display formatted test results."""
        console.print("\n" + "="*80)
        console.print("📊 COMPREHENSIVE TEST RESULTS", style="bold blue", justify="center")
        console.print("="*80)
        
        # Connection status
        conn_status = "✅ Connected" if results['connection'] else "❌ Failed"
        console.print(f"🔌 Connection: {conn_status}")
        
        # Capabilities summary
        if results['capabilities']:
            caps = results['capabilities']
            console.print(f"🛠️  Tools: {len(caps['tools'])}")
            console.print(f"📚 Resources: {len(caps['resources'])}")
            
            # Tools table
            if caps['tools']:
                tools_table = Table(title="Available Tools")
                tools_table.add_column("Tool Name", style="cyan")
                tools_table.add_column("Description", style="yellow")
                
                for tool in caps['tools'][:10]:  # Show first 10
                    tools_table.add_row(tool['name'], tool['description'])
                
                console.print(tools_table)
        
        # Tool test results
        if results['tool_tests']:
            test_table = Table(title="Tool Test Results")
            test_table.add_column("Tool", style="cyan")
            test_table.add_column("Status", style="green")
            test_table.add_column("Result Preview", style="yellow")
            
            for test in results['tool_tests']:
                status = "✅ PASS" if test['success'] else "❌ FAIL"
                preview = (test.get('result', test.get('error', 'Unknown'))[:50] + "...") if test.get('result') or test.get('error') else "No output"
                test_table.add_row(test['tool_name'], status, preview)
            
            console.print(test_table)
        
        # Summary
        total_tests = len(results['tool_tests'])
        passed_tests = sum(1 for t in results['tool_tests'] if t['success'])
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        summary = Panel(
            f"Connection: {'✅' if results['connection'] else '❌'}\n"
            f"Tools Available: {len(results['capabilities']['tools']) if results['capabilities'] else 0}\n"
            f"Tests Passed: {passed_tests}/{total_tests}\n"
            f"Success Rate: {success_rate:.1f}%",
            title="Test Summary",
            border_style="green" if success_rate > 80 else "yellow"
        )
        console.print(summary)

async def main():
    """Main execution function."""
    client = UnifiedMCPClient()
    results = await client.run_comprehensive_test()
    
    # Save results for reference
    with open('mcp_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    console.print(f"\n💾 Results saved to: mcp_test_results.json")
    
    # Exit with appropriate code
    success = results['connection'] and all(t['success'] for t in results['tool_tests'])
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
```

## 5. Common Integration Patterns

### 5.1. Repository Analysis Workflow

```python
async def analyze_repository(repo_name: str):
    """Complete repository analysis workflow."""
    config = {
        "mcpServers": {
            "unified_server": {
                "transport": "http",
                "url": "http://localhost:8009/sse/"
            }
        }
    }
    
    async with Client(config) as client:
        # 1. Check if repository is indexed
        status = await client.call_tool("get_indexing_status", {"repo_name": repo_name})
        
        # 2. Search for specific code patterns
        search_results = await client.call_tool("search_code", {
            "query": "authentication logic",
            "repo_name": repo_name,
            "limit": 10
        })
        
        # 3. Get architectural overview
        qa_result = await client.call_tool("qa_codebase", {
            "question": "How is the authentication system structured?",
            "repo_name": repo_name,
            "include_diagrams": True
        })
        
        # 4. Generate visual diagram
        diagram = await client.call_tool("generate_diagram", {
            "repo_name": repo_name,
            "overlay": "semantic",
            "limit": 20
        })
        
        return {
            "status": status,
            "search_results": search_results,
            "qa_analysis": qa_result,
            "diagram": diagram
        }
```

### 5.2. Health Monitoring Pattern

```python
async def monitor_server_health():
    """Continuous health monitoring pattern."""
    config = {
        "mcpServers": {
            "unified_server": {
                "transport": "http",
                "url": "http://localhost:8009/sse/"
            }
        }
    }
    
    async with Client(config) as client:
        # Basic health check
        health = await client.call_tool("health_check", {})
        
        # Test progress reporting
        progress_test = await client.call_tool("test_progress_reporting", {
            "duration_seconds": 5
        })
        
        # List available repositories
        repos = await client.call_tool("repo_list_indexed", {})
        
        return {
            "health_status": health,
            "progress_capability": progress_test,
            "available_repos": repos,
            "timestamp": datetime.now().isoformat()
        }
```

## 6. Error Handling & Troubleshooting

### 6.1. Common Issues & Solutions

| Issue | Symptoms | Solution |
|:------|:---------|:---------|
| **400 Bad Request** | `Client error '400 Bad Request'` | Use `"transport": "http"` not `"sse"` |
| **Connection Refused** | `Connection refused on port 8009` | Ensure MCP server is running |
| **Tool Not Found** | `Unknown tool: tool_name` | Check available tools with `list_tools()` |
| **Response Format Error** | `'list' object has no attribute 'content'` | Handle both response formats (see examples) |

### 6.2. Debugging Patterns

```python
async def debug_connection():
    """Comprehensive debugging helper."""
    config = {
        "mcpServers": {
            "unified_server": {
                "transport": "http",
                "url": "http://localhost:8009/sse/"
            }
        }
    }
    
    try:
        async with Client(config) as client:
            # Test basic connectivity
            await client.ping()
            print("✅ Ping successful")
            
            # Check server capabilities
            tools = await client.list_tools()
            print(f"✅ Found {len(tools)} tools")
            
            # Test simple tool
            result = await client.call_tool("health_check", {})
            print(f"✅ Health check: {result}")
            
    except Exception as e:
        print(f"❌ Debug failed: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
```

## 7. Best Practices & Guidelines

### 7.1. Connection Management

1. **Always use `async with` context managers** for proper resource cleanup
2. **Specify transport explicitly** - don't rely on inference for production code
3. **Handle connection failures gracefully** with try/catch blocks
4. **Reuse client instances** when possible to avoid connection overhead

### 7.2. Tool Execution

1. **Check tool availability** before calling with `list_tools()`
2. **Handle multiple response formats** (content attribute vs direct list)
3. **Provide meaningful error messages** for debugging
4. **Log tool execution** for monitoring and troubleshooting

### 7.3. Response Processing

```python
def extract_tool_result(result):
    """Standardized response extraction."""
    if hasattr(result, 'content') and result.content:
        return result.content[0].text
    elif isinstance(result, list) and result:
        return result[0].text if hasattr(result[0], 'text') else str(result[0])
    else:
        return str(result)
```

## 8. Integration Checklist

### 8.1. Pre-Integration Checklist

- [ ] FastMCP 2.10.0+ installed (`pip install fastmcp>=2.10.0`)
- [ ] Server running on `localhost:8009`
- [ ] Network connectivity to port 8009 confirmed
- [ ] Basic connection test successful

### 8.2. Implementation Checklist

- [ ] Client configuration uses `"transport": "http"`
- [ ] Async context manager pattern implemented
- [ ] Error handling for connection failures
- [ ] Response format handling for both patterns
- [ ] Tool availability checking before execution
- [ ] Logging and monitoring implemented

### 8.3. Testing Checklist

- [ ] Basic connectivity test passes
- [ ] Tool discovery works correctly
- [ ] Sample tool execution successful
- [ ] Error scenarios handled gracefully
- [ ] Performance acceptable for use case

## 9. Reference Implementation

The complete working examples are available in this repository:

- **Basic Client:** `mcp_client_simple.py` - Minimal working example
- **Comprehensive Client:** `mcp_client_test.py` - Full-featured implementation
- **Test Results:** `mcp_test_results.json` - Sample output format

### 9.1. Quick Start Command

```bash
# Install dependencies
pip install fastmcp>=2.10.0 rich

# Test basic connection
python mcp_client_simple.py

# Run comprehensive test
python mcp_client_test.py
```

## 10. Support & Resources

### 10.1. Documentation Links

- [FastMCP Client Documentation](https://gofastmcp.com/clients/client)
- [FastMCP Transport Guide](https://gofastmcp.com/clients/transports)
- [FastMCP Installation](https://gofastmcp.com/getting-started/installation)

### 10.2. Server Tool Reference

| Tool | Purpose | Required Args | Optional Args |
|:-----|:--------|:--------------|:--------------|
| `health_check` | Server health status | None | None |
| `repo_list_indexed` | List available repositories | None | None |
| `search_code` | Semantic code search | `query`, `repo_name` | `limit` |
| `qa_codebase` | Natural language code analysis | `question`, `repo_name` | `include_diagrams`, `max_results` |
| `find_entities` | Find code entities | `repo_name` | `entity_type`, `name_pattern`, `file_pattern`, `limit` |
| `generate_diagram` | Create Mermaid diagrams | `repo_name` | `overlay`, `entity_type`, `similarity_threshold`, `limit`, `max_depth` |

---

**This guide provides everything needed to successfully connect to and interact with our FastMCP Unified Server. Copy and reference these patterns for reliable MCP client implementations.** 