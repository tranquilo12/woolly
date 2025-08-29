# Woolly Repository Cleanup Plan

## Overview

This document outlines a comprehensive plan to clean up the repository by organizing loose files, consolidating documentation, moving test files to appropriate locations, and removing redundant/obsolete files.

## Current Issues Identified

1. **Test files scattered in root directory** - 8 test files in root that should be in organized test directories
2. **Documentation scattered across multiple locations** - 24+ markdown files in various locations
3. **Redundant and obsolete files** - Multiple planning documents, outdated guides, and temporary files
4. **Misplaced configuration files** - VS Code workspace file in components directory
5. **Temporary/experimental files** - JSON test results, experimental route files

## Cleanup Plan

| File/Directory                                             | Current Location | Action      | Target Location                       | Reason                    | Priority |
| ---------------------------------------------------------- | ---------------- | ----------- | ------------------------------------- | ------------------------- | -------- |
| **TEST FILES**                                             |
| `test_pydantic_ai_upgrade.py`                              | Root             | Move        | `tests/backend/`                      | Backend API test          | High     |
| `test_mcp_implementation.py`                               | Root             | Move        | `tests/backend/mcp/`                  | MCP-specific test         | High     |
| `test_pydantic_chat.py`                                    | Root             | Move        | `tests/backend/`                      | Backend API test          | High     |
| `test_chat_utilities.py`                                   | Root             | Move        | `tests/backend/`                      | Backend utility test      | High     |
| `test_streaming_poc.py`                                    | Root             | Move        | `tests/backend/`                      | Backend streaming test    | High     |
| `test_mcp_compatibility.py`                                | Root             | Move        | `tests/backend/mcp/`                  | MCP-specific test         | High     |
| `test_mcp_agent.py`                                        | Root             | Move        | `tests/backend/mcp/`                  | MCP-specific test         | High     |
| `test_conversation_flow.py`                                | Root             | Move        | `tests/backend/`                      | Backend conversation test | High     |
| `test-api-endpoints.sh`                                    | Root             | Move        | `tests/scripts/`                      | Test script               | Medium   |
| **ACTIVE DOCUMENTATION**                                   |
| `API-Endpoints-Analysis.md`                                | Root             | Move        | `docs/api/`                           | API documentation         | High     |
| `FRONTEND_AI_SDK_INTEGRATION_GUIDE.md`                     | Root             | Move        | `docs/frontend/`                      | Frontend guide            | High     |
| `MCP-Chat-Integration-Plan.md`                             | Root             | Move        | `docs/backend/mcp/`                   | MCP integration docs      | High     |
| `MCP-Hot-Swap-Integration-Guide.md`                        | Root             | Move        | `docs/backend/mcp/`                   | MCP integration docs      | High     |
| `Pydantic-AI-Chat-Endpoint-Guide.md`                       | Root             | Move        | `docs/backend/`                       | Backend API guide         | High     |
| `Pydantic-AI-Chat-Migration.md`                            | Root             | Move        | `docs/backend/`                       | Backend migration guide   | High     |
| `Backend-Streaming-Integration-Guide.md`                   | Root             | Move        | `docs/backend/`                       | Backend streaming guide   | High     |
| `FastMCP-Client-Connection-Guide.md`                       | Root             | Move        | `docs/backend/mcp/`                   | MCP client guide          | High     |
| `Indexer-Documentation.md`                                 | Root             | Move        | `docs/backend/`                       | Backend indexer docs      | High     |
| `Blueprint-to-debug-agents.md`                             | Root             | Move        | `docs/development/`                   | Development guide         | Medium   |
| `Backend-Simplification-Plan.md`                           | Root             | Move        | `docs/architecture/`                  | Architecture docs         | Medium   |
| **PLANNING DOCUMENTS (CONSOLIDATE)**                       |
| `Agents-Panel-Changes-Stage-1.md`                          | Root             | Consolidate | `docs/archive/agent-panel-changes.md` | Historical planning       | Low      |
| `Agents-Panel-Changes-Stage-2.md`                          | Root             | Consolidate | `docs/archive/agent-panel-changes.md` | Historical planning       | Low      |
| `Agents-Panel-Changes-Stage-3.md`                          | Root             | Consolidate | `docs/archive/agent-panel-changes.md` | Historical planning       | Low      |
| `app/Plan1.md`                                             | App directory    | Consolidate | `docs/archive/frontend-plans.md`      | Historical planning       | Low      |
| `app/Plan2.md`                                             | App directory    | Consolidate | `docs/archive/frontend-plans.md`      | Historical planning       | Low      |
| `app/Plan3.md`                                             | App directory    | Consolidate | `docs/archive/frontend-plans.md`      | Historical planning       | Low      |
| **OBSOLETE/REDUNDANT FILES**                               |
| `Opinion.md`                                               | Root             | Delete      | N/A                                   | Temporary opinion file    | High     |
| `Fresh-Start-Prompt.md`                                    | Root             | Delete      | N/A                                   | Outdated prompt file      | High     |
| `Correction-Strategy.md`                                   | Root             | Delete      | N/A                                   | Temporary strategy file   | High     |
| `mcp_test_results.json`                                    | Root             | Delete      | N/A                                   | Temporary test results    | High     |
| `improved-nextjs-route.ts`                                 | Root             | Delete      | N/A                                   | Experimental code file    | High     |
| `components/woolly.code-workspace`                         | Components       | Delete      | N/A                                   | Misplaced VS Code config  | Medium   |
| **MISPLACED FILES**                                        |
| `main.py`                                                  | Root             | Move        | `api/`                                | Backend entry point       | High     |
| `requirements.txt`                                         | Root             | Consolidate | Keep `api/requirements.txt` only      | Duplicate requirements    | Medium   |
| **EXISTING DOCS TO REORGANIZE**                            |
| `docs/Debugging-Agent-Creation-And-Validation-Pipeline.md` | docs/            | Move        | `docs/development/`                   | Development guide         | Medium   |
| `docs/Phase5-research.md`                                  | docs/            | Move        | `docs/archive/`                       | Historical research       | Low      |
| `api/BACKEND_API_README.md`                                | api/             | Move        | `docs/backend/README.md`              | Backend documentation     | Medium   |
| `api/agents/README.md`                                     | api/agents/      | Move        | `docs/backend/agents.md`              | Agent documentation       | Medium   |

## Directory Structure to Create

```
docs/
├── README.md                    # Main documentation index
├── api/                        # API documentation
│   ├── endpoints.md            # API-Endpoints-Analysis.md
│   └── testing.md              # API testing guides
├── backend/                    # Backend documentation
│   ├── README.md               # Backend overview
│   ├── agents.md               # Agent system docs
│   ├── streaming.md            # Streaming integration
│   ├── pydantic-migration.md   # Migration guides
│   └── mcp/                    # MCP-specific docs
│       ├── integration.md      # MCP integration
│       ├── client-guide.md     # Client connection
│       └── hot-swap.md         # Hot swap guide
├── frontend/                   # Frontend documentation
│   ├── ai-sdk-integration.md   # Frontend AI SDK guide
│   └── components.md           # Component documentation
├── development/                # Development guides
│   ├── debugging-agents.md     # Debugging guide
│   └── testing.md              # Testing strategies
├── architecture/               # Architecture documentation
│   └── simplification-plan.md # Backend simplification
└── archive/                    # Historical documents
    ├── agent-panel-changes.md  # Consolidated panel changes
    ├── frontend-plans.md       # Consolidated frontend plans
    └── phase5-research.md      # Historical research

tests/
├── backend/                    # Backend tests
│   ├── test_pydantic_ai_upgrade.py
│   ├── test_pydantic_chat.py
│   ├── test_chat_utilities.py
│   ├── test_streaming_poc.py
│   ├── test_conversation_flow.py
│   └── mcp/                    # MCP-specific tests
│       ├── test_mcp_implementation.py
│       ├── test_mcp_compatibility.py
│       └── test_mcp_agent.py
├── frontend/                   # Frontend tests (existing)
│   ├── streaming-chat-simple.test.tsx
│   └── streaming-chat.test.tsx
└── scripts/                    # Test scripts
    └── test-api-endpoints.sh
```

## Implementation Steps

### Phase 1: Create Directory Structure (High Priority)

1. Create `docs/` subdirectories: `api/`, `backend/`, `frontend/`, `development/`, `architecture/`, `archive/`
2. Create `tests/backend/` and `tests/backend/mcp/` directories
3. Create `tests/scripts/` directory

### Phase 2: Move Test Files (High Priority)

1. Move all `test_*.py` files from root to appropriate `tests/backend/` locations
2. Move MCP-specific tests to `tests/backend/mcp/`
3. Move `test-api-endpoints.sh` to `tests/scripts/`

### Phase 3: Organize Documentation (High Priority)

1. Move API documentation to `docs/api/`
2. Move backend documentation to `docs/backend/`
3. Move frontend documentation to `docs/frontend/`
4. Move development guides to `docs/development/`

### Phase 4: Consolidate Planning Documents (Medium Priority)

1. Merge agent panel change documents into single archive file
2. Merge frontend plan documents into single archive file
3. Move to `docs/archive/`

### Phase 5: Remove Obsolete Files (High Priority)

1. Delete temporary opinion and strategy files
2. Delete experimental code files
3. Delete test result JSON files
4. Remove misplaced configuration files

### Phase 6: Final Cleanup (Low Priority)

1. Update README.md to reference new documentation structure
2. Update any internal links in documentation
3. Create documentation index files

## Benefits of This Cleanup

1. **Improved Organization**: Clear separation of tests, documentation, and code
2. **Better Discoverability**: Logical grouping makes finding relevant files easier
3. **Reduced Clutter**: Root directory contains only essential project files
4. **Maintainability**: Easier to maintain and update documentation
5. **Professional Structure**: Standard project layout following best practices

## Files to Keep in Root

After cleanup, the root directory should only contain:

- Core configuration files (`package.json`, `tsconfig.json`, etc.)
- Docker and deployment files
- Main README.md
- License and contribution files
- Essential build and dependency files

This cleanup will reduce root directory clutter by ~30 files while maintaining all valuable content in organized locations.
