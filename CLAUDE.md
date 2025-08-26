# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CORE PRINCIPLES (DISPLAY AT START OF EVERY RESPONSE)

<law>
Development Principles:
1. NEVER create placeholder, mock, or fake implementations - only real working code
2. ALWAYS complete every step fully without skipping or truncating code  
3. ALWAYS test implementations and verify they work before claiming completion
4. ALWAYS follow the existing codebase patterns and architecture
5. ALWAYS display these 5 principles at the start of every response
6. NEVER call anything production ready unless I the user declares it so.
</law>

## 📋 WORKFLOW

### Before Any Implementation:
1. **Plan First**: Use "think" or "ultrathink" for complex problems
2. **Ask Questions**: Clarify requirements if anything is unclear
3. **Read Context**: Understand existing code patterns and architecture
4. **No Coding Yet**: Explicitly avoid writing code during planning phase

### During Implementation:
- **Show Complete Code**: Never use "..." or "code remains the same"
- **One Step at a Time**: Complete each logical unit before moving on
- **Test Immediately**: Run and verify each component works
- **Real Implementation**: No TODOs, placeholders, or mock functions

### After Implementation:
- **Run Tests**: Execute relevant test suites and fix failures
- **Run Linters**: Fix all linting errors and warnings  
- **Verify End-to-End**: Ensure the complete feature actually works
- **Update Documentation**: Keep README and docs in sync

## 🧪 TEST-DRIVEN DEVELOPMENT

When building new features:
1. **Write Tests First** based on expected input/output pairs
2. **State TDD Intent** explicitly to avoid creating mocks
3. **Confirm Tests Fail** before implementing functionality
4. **Implement Real Code** (not mocks) to make tests pass
5. **Don't Modify Tests** unless requirements change

## 🚫 NEVER DO THIS

### Code Quality Issues:
- ❌ Placeholder implementations or "TODO" comments
- ❌ Fake API calls or simulated responses
- ❌ Silent failures or poor error handling
- ❌ Magic numbers or hardcoded configuration
- ❌ Functions with high cyclomatic complexity

### Workflow Issues:
- ❌ Skipping steps or leaving functions incomplete
- ❌ Committing untested or non-working code
- ❌ Ignoring linter errors or test failures
- ❌ Making assumptions about external dependencies

## ✅ ALWAYS DO THIS

### Code Standards:
- ✅ Implement complete, working functionality
- ✅ Handle errors with meaningful messages
- ✅ Use descriptive variable and function names
- ✅ Follow existing code style and patterns
- ✅ Add appropriate logging for debugging

### Verification:
- ✅ Test your implementation thoroughly
- ✅ Run the full test suite before finishing
- ✅ Check that builds complete successfully
- ✅ Verify functionality works end-to-end

## 🔧 PROJECT SETUP

### Build Commands:
```bash
# Add your project's build commands here, e.g.:
# npm run build
# make build
# python setup.py build
```

### Test Commands:
```bash
# Add your project's test commands here, e.g.:
# npm test
# pytest
# make test
```

### Linting Commands:
```bash
# Add your project's linting commands here, e.g.:
# npm run lint
# flake8 .
# cargo clippy
```

### Development Commands:
```bash
# Add your project's dev commands here, e.g.:
# npm run dev
# python manage.py runserver
# cargo run
```

## 🏗️ ARCHITECTURE GUIDELINES

### Code Organization:
- Follow the existing module/package structure
- Keep related functionality together
- Maintain clear separation of concerns
- Use consistent naming conventions

### Dependencies:
- Only use dependencies already in the project
- Ask before adding new dependencies
- Prefer standard library solutions when possible
- Document any new dependencies added

### Error Handling:
- Catch specific exceptions, not general ones
- Provide actionable error messages
- Log errors with sufficient context
- Never suppress errors silently

## 📝 COMMIT GUIDELINES

### Format:
Use [Conventional Commits](https://www.conventionalcommits.org/):
```
type(scope): description

Examples:
feat(auth): add user authentication
fix(api): resolve memory leak in data processing
docs(readme): update installation instructions
```

### Rules:
- Write clear, descriptive commit messages
- Don't mention Claude or AI assistance in commits
- Commit logical units of work
- Include issue numbers when relevant

## 🔍 CODE REVIEW CHECKLIST

Before claiming completion, verify:
- [ ] Code compiles and runs without errors
- [ ] All tests pass
- [ ] No linting errors or warnings  
- [ ] Error handling is comprehensive
- [ ] Code follows project patterns
- [ ] Documentation is updated
- [ ] No placeholder implementations
- [ ] Performance is acceptable
- [ ] Security best practices followed

## 🎯 QUALITY STANDARDS

### Function Design:
- Single responsibility principle
- Easy to test without mocking core features
- Clear input/output contracts
- Proper parameter validation
- Comprehensive error handling

### File Organization:
- Logical grouping of related code
- Appropriate abstraction levels
- Clear module interfaces
- Minimal coupling between components

## 🚨 EMERGENCY STOPS

If you find yourself:
- Creating placeholder or mock implementations → STOP and implement real functionality
- Skipping implementation details → STOP and complete everything fully  
- Ignoring test failures → STOP and fix all issues
- Making assumptions about requirements → STOP and ask for clarification

## 🔄 CONTINUOUS IMPROVEMENT

### Self-Check Questions:
1. Would I deploy this code to production right now?
2. Does every function do exactly what it claims to do?
3. Are all edge cases handled appropriately?
4. Is the code maintainable by other developers?
5. Did I test the complete user journey?

### When Stuck:
- Use subagents to verify your approach
- Break complex problems into smaller pieces
- Research existing solutions in the codebase
- Ask the user for guidance rather than guessing

## 🔍 TROUBLESHOOTING & HISTORICAL CONTEXT AWARENESS

### Before Starting Any Troubleshooting or Code Writing:

#### **1. Check Project Memory (MANDATORY)**
```bash
# ALWAYS start by checking what problems have been encountered before
/mcp__serena__list_memories
/mcp__serena__read_memory [relevant_memory_name]
```

**Required Memories to Check:**
- `deployment_success_record` - What solutions worked in production
- `build_session_state` - Current build issues and their status
- `gradle_compatibility_analysis` - Android build problems and fixes
- `nodejs_upgrade_resolution` - Node.js version compatibility solutions
- `cactus_framework_integration` - Framework-specific issue patterns
- `development_environment_setup` - Environment configuration problems

#### **2. Analyze Historical Patterns**
Before implementing any solution:
- ✅ **Read relevant memories** to understand what was tried before
- ✅ **Check why previous attempts failed** from memory documentation
- ✅ **Identify successful solution patterns** from past experiences
- ✅ **Look for similar error patterns** in project history
- ✅ **Verify if environment changes** might affect previous solutions

#### **3. Context-Aware Problem Analysis**
```typescript
// Template for historical context analysis
Before proceeding with [PROBLEM], checking project history:

1. **Similar Issues Found**: [List from memory]
2. **Previous Solutions Tried**: [What was attempted before]
3. **Why They Failed**: [Root causes identified]
4. **Working Solutions**: [What actually worked]
5. **Environment Changes**: [What might be different now]
6. **Risk Assessment**: [What could go wrong this time]
```

### **Troubleshooting Workflow with Historical Context**

#### **Phase 1: Historical Research (REQUIRED)**
```bash
# 1. Search for related issues in project memory
/mcp__serena__search_nodes "error_keyword OR problem_type"

# 2. Check build and environment state
/mcp__serena__read_memory "build_session_state"
/mcp__serena__read_memory "development_environment_setup"

# 3. Look for framework-specific patterns
/mcp__serena__read_memory "cactus_framework_integration"
```

#### **Phase 2: Current Analysis with Context**
- **Environment Validation**: Compare current setup with known working configurations
- **Dependency Check**: Verify no breaking changes since last successful build
- **Pattern Matching**: Match current error against historical error patterns
- **Solution Evolution**: Build on previous solutions rather than starting fresh

#### **Phase 3: Implementation with Memory Updates**
```bash
# After successful resolution, UPDATE project memory
/mcp__serena__write_memory "problem_type_resolution" "
# [Problem Type] Resolution - [Date]

## Problem
[Describe the issue encountered]

## Previous Attempts That Failed
1. [Solution A] - Failed because [reason]
2. [Solution B] - Failed because [reason]

## Working Solution
[Detailed solution that worked]

## Why It Worked
[Root cause analysis and explanation]

## Prevention
[How to avoid this issue in future]

## Related Issues
[Link to similar problems or dependencies]
"
```

### **Common Issue Categories to Track**

#### **Build & Environment Issues**
- Node.js version compatibility problems
- Gradle/Android SDK configuration
- Expo/React Native version conflicts
- Cache corruption and resolution
- Platform-specific build failures

#### **Framework Integration Issues**
- Cactus Framework loading problems
- MCP server connection failures
- RAG system initialization errors
- Model loading and memory issues
- Platform compatibility problems

#### **Performance & Runtime Issues**
- Memory leaks and optimization
- Network connectivity problems  
- Device-specific compatibility
- Model inference failures
- Storage and persistence issues

### **Memory Documentation Standards**

#### **Problem Documentation Template**
```markdown
# [Issue Type] - [Date] - [Status: Resolved/Ongoing]

## Problem Description
[Clear description of what went wrong]

## Environment Context
- Node.js: [version]
- React Native: [version] 
- Platform: [iOS/Android/Web]
- Device/Emulator: [specifics]

## Error Messages/Symptoms
```
[Exact error messages and stack traces]
```

## Investigation Steps
1. [What was checked first]
2. [What logs were examined]
3. [What tools were used]

## Solutions Attempted
### ❌ Failed Attempt 1: [Solution Name]
- **What was tried**: [detailed steps]
- **Why it failed**: [root cause]
- **Time spent**: [duration]

### ❌ Failed Attempt 2: [Solution Name]  
- **What was tried**: [detailed steps]
- **Why it failed**: [root cause]
- **Time spent**: [duration]

### ✅ Working Solution: [Solution Name]
- **What worked**: [detailed steps]
- **Why it worked**: [root cause analysis]
- **Time to resolution**: [duration]

## Prevention Strategy
[How to avoid this issue in the future]

## Related Issues
[Links to similar problems or dependencies]
```

### **Automatic Historical Context Integration**

Add to your workflow commands:
```bash
# Add these to your .bashrc or project scripts
alias debug-start="echo 'Checking project history...' && /mcp__serena__list_memories"
alias problem-search="/mcp__serena__search_nodes"
alias solution-save="/mcp__serena__write_memory"
```

### **Quality Gates for Historical Awareness**

Before claiming any issue is "resolved":
- [ ] ✅ Checked project memory for similar issues
- [ ] ✅ Documented why previous solutions failed  
- [ ] ✅ Verified the current solution against historical context
- [ ] ✅ Updated project memory with new resolution
- [ ] ✅ Added prevention strategy for future occurrences
- [ ] ✅ Linked to related issues for future reference

### **Memory Maintenance Schedule**

**Weekly**: Update `build_session_state` with current status
**After Major Changes**: Update relevant integration memories
**After Problem Resolution**: Always create/update resolution memory
**Monthly**: Review and consolidate related issue memories
**Before Major Releases**: Verify all critical issue resolutions are documented

---

**Remember: The goal is production-ready code that solves real problems. When in doubt, implement the real solution rather than a placeholder.**

## Project Overview

**Cactus Chat** - Mobile AI chat application demonstrating the Cactus Framework for on-device LLM inference. Built with React Native, Expo, and TypeScript.

## Development Commands

### Core Development
```bash
# Install dependencies
yarn

# Start development (requires dev build - Expo Go not supported)
yarn start

# Platform-specific builds
yarn android
yarn ios
yarn web

# Clean rebuild (when having issues)
yarn reset
```

### Testing & Quality
```bash
# Run tests with watch mode
yarn test

# Lint code
yarn lint
```

### iOS Specific
```bash
# Clean iOS build
yarn start-clean-ios
```

## Architecture Overview

### Core Technologies
- **Framework**: Expo SDK ~52 + React Native 0.76 + TypeScript
- **UI**: Tamagui design system with Inter font and theme support
- **Navigation**: Expo Router (file-based routing in `/app` directory)
- **AI Engine**: `cactus-react-native` for on-device LLM inference
- **Storage**: MMKV (`react-native-mmkv`) for app state and conversation persistence
- **Internationalization**: i18next with English/Russian support

### Project Structure

#### `/app` - Main application screens (Expo Router)
- **Core Flow**: onboarding → functionality selection → model download → chat interface
- **Key Screens**: `index.tsx` (main chat), `settingsScreen.tsx`, `conversationsScreen.tsx`

#### `/services` - Business logic layer
- **`models.ts`**: Model management (download, storage, metadata)
- **`storage.ts`**: MMKV persistence layer for settings and conversations
- **`chat/`**: AI provider integrations (currently Cactus-only, others commented out)
- **`supabase.ts`**: Remote model catalog and telemetry

#### `/contexts` - Global state management
- **`modelContext.tsx`**: Central model loading, inference hardware settings, conversation state

#### `/components/ui` - Reusable UI components
- **`chat/`**: Chat interface components (messages, input, model display)
- **`settings/`**: Configuration and preferences UI
- **`onboarding/`**: First-run experience components

#### `/utils` - Utility functions
- **`modelMetrics.ts`**: Performance tracking for LLM inference
- **`voiceFunctions.ts`**: Text-to-speech integration

### Critical Integration Points

#### Cactus Framework Integration
- **Model Loading**: `CactusLM.init()` with GPU acceleration on iOS, CPU on Android
- **Inference**: Streaming text generation with performance metrics
- **Hardware Detection**: Automatic CPU/GPU selection based on device capabilities

#### Storage Architecture
- **Conversations**: Persisted with MMKV, includes message history and model metadata
- **Models**: Local storage in `${FileSystem.documentDirectory}local-models/`
- **Settings**: Token limits, inference hardware preferences, system prompts

#### Model Management Flow
1. **Discovery**: Fetch available models from Supabase based on device RAM
2. **Download**: Direct model file downloads with progress tracking
3. **Loading**: Initialize CactusLM context with optimal hardware settings
4. **Inference**: Streaming completion with real-time metrics

## Development Notes

### Platform Considerations
- **iOS**: GPU acceleration available, requires development build
- **Android**: CPU-only inference, may require emulator setup
- **Hardware Requirements**: Models filtered by device RAM capacity

### Key Dependencies
- `cactus-react-native@^0.2.7` - Core AI inference (not compatible with Expo Go)
- `@tamagui/*@^1.125.33` - Complete UI framework stack
- `react-native-mmkv@^3.2.0` - High-performance storage
- `expo-file-system` - Model file management
- `react-native-device-info` - Hardware capability detection

### Testing Strategy
- Jest with Expo preset for unit testing
- Component snapshot testing in `__tests__/__snapshots__/`
- Manual testing on physical devices required for AI functionality

### Troubleshooting
- **Cactus not working**: Check if using development build (not Expo Go)
- **Model loading issues**: Verify file permissions and available storage
- **Performance problems**: Monitor ModelMetrics for inference bottlenecks
- **Clean slate needed**: Use `yarn reset` to clear all caches and rebuilds

## Android Development Environment

### Environment Variables
- `ANDROID_HOME=/opt/android-sdk`
- `ANDROID_SDK_ROOT=/opt/android-sdk`  
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`

### Available Tools
- **ADB**: `/opt/android-sdk/platform-tools/adb`
- **Emulator**: `/opt/android-sdk/emulator/emulator`
- **SDK Manager**: `/opt/android-sdk/cmdline-tools/bin/sdkmanager`
- **AVD Manager**: `/opt/android-sdk/cmdline-tools/bin/avdmanager`
- **Maestro**: `~/.maestro/bin/maestro`

### Available AVDs
- `test_device` (x86_64) - Requires hardware virtualization
- `test_device_arm` (ARM64) - Works without hardware virtualization
- `test_device_large` - Large screen variant
- `test_device_x86_large` - Large screen x86_64 variant

### Common Android Commands
```bash
# Start ARM emulator (headless - recommended for this project)
emulator -avd test_device_arm -no-window -no-audio

# Start x86_64 emulator (headless, after enabling hardware virt)  
emulator -avd test_device -no-window -no-audio

# Check connected devices (physical + emulators)
adb devices

# Install APK to device
adb install app.apk

# Run Maestro tests for mobile app automation
maestro test flow.yaml

# Create new AVD
avdmanager create avd -n "device_name" -k "system-images;android-34;google_apis;arm64-v8a"

# List available AVDs
emulator -list-avds
```

### Android SDK Structure
- **Platforms**: API levels 33, 34, 35, 36 available at `/opt/android-sdk/platforms/`
- **Build Tools**: Multiple versions (30.0.3, 33.0.0, 33.0.1, 34.0.0, 35.0.0)
- **System Images**: Android 30, 34 with emulator support
- **NDK**: Versions 23.1.7779620, 27.0.12077973 for native development

### Testing Framework
- **Maestro** is installed for mobile app automation and testing
- Maestro works with both emulators and real devices via ADB
- Use `maestro start-device` to automatically start an appropriate emulator
- Headless operation (CLI only) - no Android Studio GUI needed

### Notes for Cactus Chat Development
- **Hardware Virtualization**: Will be enabled after next reboot for faster x86_64 emulation
- **Recommended Setup**: Use ARM emulators (`test_device_arm`) for consistent performance
- **Cactus Framework**: Works better on physical devices, but emulators supported for development
- **Memory Considerations**: Choose models appropriate for emulator RAM limits

# 🚀 CACTUS FRAMEWORK UPGRADE + MCP ENHANCEMENT PROJECT

## Executive Summary

**PROCEED WITH UPSTREAM UPGRADE + MCP ENHANCEMENT**

This project will upgrade the Cactus Chat application from the current v0.2.7 framework to upstream v0.2.10, then implement Model Context Protocol (MCP) integration for Retrieval-Augmented Generation (RAG) capabilities.

## 📊 Current State Analysis

### Current Framework (v0.2.7)
- ❌ **Limited Capabilities**: Basic local inference only
- ❌ **No Agent System**: Simple chat service without tool support
- ❌ **No MCP Support**: No protocol implementation for external integrations
- ❌ **Basic HTTP**: Limited to EventSource streaming only
- ✅ **Stable Base**: Working React Native + Expo infrastructure

### Upstream Framework (v0.2.10)
- ✅ **Agent Architecture**: Production-ready CactusAgent with tool calling
- ✅ **Tool System**: OpenAI-compatible tool definitions and execution
- ✅ **Cloud Integration**: Hybrid local/remote processing capabilities
- ✅ **HTTP Infrastructure**: Robust fetch-based networking
- ✅ **Backward Compatible**: Safe upgrade path from v0.2.7

## 🎯 Implementation Strategy

### Phase 1: Framework Upgrade (Week 1)
**Objective**: Upgrade to upstream Cactus v0.2.10 with backward compatibility

#### Tasks:
1. **Dependency Update**
   ```bash
   npm install cactus-react-native@^0.2.10
   ```

2. **Chat Service Enhancement**
   - Replace basic `sendChatMessage` with `CactusAgent`
   - Integrate agent tool system
   - Preserve existing streaming patterns

3. **API Integration**
   - Enable agent tool calling capabilities
   - Test backward compatibility with existing models
   - Validate performance on OnePlus 12

4. **Testing & Validation**
   - Ensure existing functionality preserved
   - Verify agent system integration
   - Performance benchmarks vs v0.2.7

### Phase 2: MCP Protocol Implementation (Week 2-3)
**Objective**: Build MCP JSON-RPC client using upstream HTTP infrastructure

#### Tasks:
1. **MCP Client Development**
   ```typescript
   // New service: services/mcp/mcp-client.ts
   export class MCPClient {
     async connect(serverUrl: string): Promise<void>
     async sendRequest(method: string, params: any): Promise<any>
     async listResources(): Promise<MCPResource[]>
     async listTools(): Promise<MCPTool[]>
   }
   ```

2. **RAG Service Layer**
   ```typescript
   // New service: services/rag/rag-service.ts
   export class RAGService {
     async queryRelevantDocs(query: string): Promise<Document[]>
     async augmentPrompt(query: string, context: Document[]): string
   }
   ```

3. **Agent Integration**
   - Connect MCP tools to CactusAgent system
   - Implement document retrieval as agent tools
   - Context-aware response generation

4. **Error Handling & Recovery**
   - MCP server connectivity management
   - Graceful fallback to local inference
   - Timeout and retry logic

### Phase 3: Production Integration (Week 4)
**Objective**: Full production-ready MCP+RAG system

#### Tasks:
1. **UI Components**
   - RAG context display in chat interface
   - Source attribution and references
   - MCP server configuration UI

2. **Performance Optimization**
   - Mobile-optimized vector operations
   - Efficient context caching
   - Background document processing

3. **Configuration Management**
   - MCP server endpoint management
   - RAG settings and preferences
   - Model-specific RAG configurations

4. **Testing & Deployment**
   - E2E testing with MCP servers
   - Performance validation on target hardware
   - Production deployment readiness

## 🏗️ Architecture Design

### Enhanced Service Architecture
```
services/
├── chat/
│   ├── _chat.ts           # Enhanced with CactusAgent
│   ├── mcp-rag.ts         # NEW: MCP+RAG integration
│   └── [existing providers]
├── mcp/                   # NEW: MCP Protocol Layer
│   ├── mcp-client.ts      # JSON-RPC 2.0 client
│   ├── mcp-transport.ts   # HTTP/WebSocket transport
│   └── mcp-types.ts       # MCP protocol types
├── rag/                   # NEW: RAG Service Layer
│   ├── rag-service.ts     # Document retrieval/augmentation
│   ├── vector-store.ts    # Mobile-optimized vector operations
│   └── context-manager.ts # Context preparation
└── [existing services]
```

### Agent-Tool Integration
```typescript
// Enhanced chat service with MCP tools
const { agent, error } = await CactusAgent.init({
  model: modelPath,
  n_ctx: 2048
});

// Register MCP tools
const ragTool = agent.addTool(
  async (query: string) => ragService.queryRelevantDocs(query),
  'Search relevant documents for context',
  { query: { type: 'string', description: 'Search query', required: true } }
);

// Context-aware completion
const result = await agent.completionWithTools(messages, {
  n_predict: 200,
  temperature: 0.7
});
```

## 🔧 Technical Requirements

### New Dependencies
```json
{
  "cactus-react-native": "^0.2.10",  // Framework upgrade
  "@anthropic-ai/mcp": "^1.0.0",     // MCP protocol client (if available)
  "uuid": "^9.0.0",                   // Request ID generation
  "ws": "^8.0.0"                      // WebSocket support for MCP
}
```

### MCP Server Integration
- **HTTP Transport**: JSON-RPC 2.0 over HTTPS
- **WebSocket Transport**: Real-time MCP communication
- **Authentication**: API key and token management
- **Error Handling**: Comprehensive retry and fallback logic

### RAG Implementation
- **Document Processing**: Text extraction and chunking
- **Vector Search**: Mobile-optimized similarity search
- **Context Preparation**: Prompt augmentation with relevant docs
- **Source Attribution**: Track document sources for user display

## 📊 Success Metrics

### Framework Upgrade Success
- ✅ **Backward Compatibility**: All existing features preserved
- ✅ **Performance**: No degradation in inference speed
- ✅ **Agent Integration**: Tool calling system functional
- ✅ **Stability**: No crashes or memory leaks

### MCP Integration Success
- ✅ **Protocol Compliance**: JSON-RPC 2.0 specification adherence
- ✅ **RAG Functionality**: Document retrieval and context augmentation
- ✅ **Performance**: <2s response time with RAG context
- ✅ **Error Handling**: Graceful fallback to local inference

### Production Readiness
- ✅ **User Experience**: Seamless MCP+RAG integration
- ✅ **Performance**: Production-ready speed on OnePlus 12
- ✅ **Stability**: Crash-free sessions with MCP servers
- ✅ **Documentation**: Complete implementation documentation

## ⚠️ Risk Mitigation

### Technical Risks
- **Framework Breaking Changes**: Comprehensive testing before upgrade
- **MCP Protocol Complexity**: Phased implementation with fallbacks
- **Mobile Performance**: Optimization for resource-constrained devices
- **Integration Complexity**: Incremental integration with rollback capability

### Timeline Risks
- **Dependency Issues**: Early dependency validation
- **Testing Overhead**: Parallel development and testing
- **Performance Tuning**: Built-in performance monitoring
- **Documentation Gaps**: Concurrent documentation development

## 🚀 Next Steps

1. **Immediate**: Begin Phase 1 framework upgrade
2. **Week 1**: Complete CactusAgent integration
3. **Week 2-3**: Implement MCP protocol layer
4. **Week 4**: Production integration and optimization
5. **Ongoing**: Performance monitoring and optimization

## 📚 Resources

- **Upstream Cactus**: [https://github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus)
- **MCP Specification**: [https://spec.modelcontextprotocol.io/](https://spec.modelcontextprotocol.io/)
- **Agent Examples**: `/react/example` in upstream repository
- **Performance Benchmarks**: OnePlus 12 optimization targets

---

**Status**: Ready for implementation with clear upgrade path and comprehensive architecture design.