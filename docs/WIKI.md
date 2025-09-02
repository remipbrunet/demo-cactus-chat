# Cactus Chat Documentation Wiki

## Table of Contents

1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
3. [MCP Integration](#mcp-integration)
   - [Overview](#mcp-overview)
   - [Implementation](#mcp-implementation)
   - [Testing Guide](#mcp-testing-guide)
4. [Development](#development)
5. [Community](#community)

---

## Project Overview

### Welcome to Cactus Chat 🌵

This is a **demo** app created to demonstrate the [Cactus](https://github.com/cactus-compute/cactus) Framework. It's built in React Native and runs LLM text generation on your phone!

[![Download App](https://img.shields.io/badge/Cactus_Chat_iOS-grey?style=for-the-badge&logo=apple&logoColor=white)](https://apps.apple.com/gb/app/cactus-chat/id6744444212)
[![Download App](https://img.shields.io/badge/Cactus_Chat_Android_App-grey?style=for-the-badge&logo=android&logoColor=white)](https://play.google.com/store/apps/details?id=com.rshemetsubuser.myapp&pcampaignid=web_share)

---

## Getting Started

### Build Instructions

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

#### Installation

1. **Install dependencies**
   ```bash
   yarn
   ```

2. **Start the app**
   ```bash
   yarn run
   ```

**NOTE** - Cactus relies on native modules, which aren't supported by the `expo start` command.

In the output, you'll find options to open the app in a:
- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

#### Clean Build

To definitively clear your build and re-build the project from scratch:

```bash
rm -rf node_modules ios android .expo
```

Then return to the installation steps.

---

## MCP Integration

### MCP Overview

The Model Context Protocol (MCP) integration allows Cactus Chat to connect to external MCP servers for enhanced functionality including tool calling, specialized models, and API integrations.

#### Key Features

- **External MCP Server Support**: Connect to HTTP/HTTPS MCP servers
- **Tool Calling**: Enable models to interact with external tools and APIs
- **Multiple Server Management**: Support for multiple simultaneous MCP connections
- **Persistent Configuration**: Server settings saved across app sessions

### MCP Implementation

#### 1. Architecture Components

##### MCP Client Service (`services/mcp/client.ts`)
- SSE and HTTP transport support
- Connection management for multiple servers
- Tool invocation with JSON-RPC protocol
- Real-time status updates

##### Storage Layer (`services/mcp/storage.ts`)
- Persistent storage using AsyncStorage
- Default Context7 server configuration
- CRUD operations for server management

##### Settings UI (`components/ui/settings/MCPServerSettings.tsx`)
- Add/Edit/Delete MCP servers
- Connection status indicators
- Test connection functionality
- Enable/disable servers

##### Chat Integration (`services/chat/unified-mcp.ts`)
- Tool detection in model responses
- Automatic tool invocation
- Enhanced system prompts with tool descriptions
- Model capability detection

#### 2. Integrating External MCP Servers

##### Running an External MCP Server

**Prerequisites:**
- Node.js (LTS version recommended)
- npm (Node Package Manager)

**Example: Sequential Thinking Server**

1. Clone the repository:
   ```bash
   git clone https://github.com/modelcontextprotocol/servers.git
   cd servers/src/sequentialthinking
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

The server will log its address (e.g., `http://localhost:3000`).

##### Connecting from Cactus Chat

1. Navigate to Settings → MCP Servers
2. Add new server with the URL
3. Enable the server and test connection
4. Select the MCP-enabled model in chat

**Network Configuration Notes:**
- Android emulator: Use `10.0.2.2` instead of `localhost`
- Physical devices: Use host machine's IP address
- Ensure firewall allows connections

#### 3. Tool Calling Implementation

##### What is Tool Calling?

Tool calling enables LLMs to interact with external tools, APIs, or internal application functionalities. The model recommends tool execution in a structured format.

##### Supported Models

**Models with Native Tool Calling:**
- Hammer2.1-1.5B (Recommended)
- Llama-3.2-1B-Tool-Calling-V2
- Models with "tool" or "function" in name

**Note:** Qwen 2.5 models do not properly support tool calling despite claims.

##### Tool Definition Format

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: { [key: string]: ToolParameter };
    required?: string[];
  };
  execute: (args: any) => Promise<any>;
}
```

##### Tool Call Format

Models generate tool calls in XML format:
```xml
<tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
```

##### Response Processing Flow

1. **Detection**: Model generates `<tool_call>` tags
2. **Parsing**: JSON extracted and validated
3. **Invocation**: Tool called via MCP client
4. **Display**: Results shown with visual indicators

### MCP Testing Guide

#### Quick Start Testing

##### Step 1: Configure MCP Server
1. Open Settings (⚙️)
2. Navigate to "MCP Servers"
3. Add your server URL
4. Toggle ON and test connection

##### Step 2: Test Prompts

**Library Resolution:**
```
According to Context7, how do I use hooks in React?
```

**Documentation Retrieval:**
```
Get the documentation for Next.js routing from Context7
```

**Combined Usage:**
```
I need Context7's information about Jinja2 template handling
```

#### Success Indicators

- ✅ Green wifi icon = MCP connected
- ✅ "🔧 Invoking MCP tools..." = Processing
- ✅ "📡 Calling tool_name..." = Tool invoked
- ✅ "✅ Documentation retrieved" = Success

#### Troubleshooting

##### Connection Issues
- Verify server is running
- Check URL correctness
- Ensure network connectivity
- Review firewall settings

##### Tool Calling Issues
- Confirm model supports tools (Hammer/Llama models)
- Check MCP server connection status
- Review console logs for errors

##### SSE Connection Problems
- Try HTTP endpoint instead
- Check server logs
- Verify authentication requirements

#### Advanced Configuration

##### API Key Support
Edit server settings to add authentication:
- API keys sent as headers
- Support for custom auth schemes

##### Multiple Servers
- Configure multiple MCP servers
- Each server can provide different tools
- Automatic tool routing based on availability

#### MCP Architecture Options

##### Option 1: Generic Tool Handling (For Dynamic Models)
The MCP integration can be completely generic and scalable for models that support dynamic tool selection:

**Key Design Principles:**
- **No Hardcoded Logic**: The system does not contain any server-specific keywords or detection logic
- **Dynamic Tool Discovery**: All tools are discovered dynamically from connected MCP servers
- **Model-Based Selection**: The LLM model itself decides which tool to use based on descriptions
- **Unlimited Scalability**: Works identically whether you have 2 or 200 MCP servers

**How It Works:**
1. **Tool Discovery**: System queries all connected MCP servers for their available tools
2. **Prompt Generation**: Creates a unified prompt with all tools and their descriptions
3. **Model Decision**: The LLM analyzes the user's question and selects the appropriate tool
4. **Generic Invocation**: Tool calls are routed to the correct server dynamically

##### Option 2: Keyword-Based Static Tool Selection (For Hammer 2.1)

For models like Hammer 2.1 (1.5B parameters) that only support static tool calling, a keyword-based selection system is implemented:

**Implementation Details:**
- **File**: `/services/chat/hammer-prompt-builder.ts`
- **Purpose**: Detect keywords in user queries to determine which MCP server to use
- **Benefit**: Works reliably with smaller models that can't dynamically select tools

**Keyword Mappings:**

**Context7 (NPM/Framework Documentation):**
```javascript
// Triggers Context7's tools
'react', 'vue', 'angular', 'npm', 'hook', 
'component', 'useState', 'useEffect', 'webpack',
'typescript', 'eslint', 'jest', 'cypress'
```

**Microsoft Docs (Azure/Microsoft Documentation):**
```javascript
// Triggers microsoft_docs_search tool
'azure', 'microsoft', '.net', 'dotnet', 'cosmos', 
'blob', 'entra', 'pim', 'active directory', 'graph',
'office', 'teams', 'sharepoint', 'dynamics'
```

**How Keyword Selection Works:**
1. User asks a question (e.g., "What is PIM in EntraID?")
2. System strips any prefixes (like `/no_think`)
3. Keywords are detected ('entra' and 'pim' found)
4. Specific prompt generated for the matching tool
5. Hammer 2.1 outputs JSON tool call
6. MCP server processes the request
7. Results parsed from nested response structure
8. Results displayed in clean, natural language

**Critical Implementation Detail - Nested Response Handling:**
MCP servers may return responses with complex nested structures. For example, Microsoft Docs returns:
```javascript
// Response structure from MCP server
{
  result: {
    content: [{
      type: "text",
      text: "[{\"title\":\"Title Here\",\"content\":\"Actual content\"}]"
    }]
  }
}
```
The system must parse this nested structure to extract clean content without JSON artifacts or titles showing in the chat.

**Verified Test Cases:**
- ✅ "How do React hooks work?" → Context7's get-library-docs
- ✅ "What is PIM in EntraID?" → microsoft_docs_search
- ✅ "Azure Blob Storage setup" → microsoft_docs_search
- ✅ Questions without keywords → Shows all available tools

**Adding More Keywords:**
1. Edit `/services/chat/hammer-prompt-builder.ts`
2. Add keywords to appropriate section (lines 9-16 for Context7, lines 41-50 for Microsoft)
3. Restart Metro bundler if needed

This dual architecture ensures the system works optimally with both advanced models (dynamic selection) and smaller models (keyword-based selection).

---

## Development

### Project Structure

```
demo-cactus-chat/
├── app/                    # Main application screens
├── components/             # Reusable UI components
│   └── ui/
│       ├── chat/          # Chat-related components
│       └── settings/      # Settings components
├── services/              # Business logic and services
│   ├── chat/             # Chat service implementations
│   ├── mcp/              # MCP client and types
│   └── models.ts         # Model definitions
├── utils/                 # Utility functions
└── docs/                  # Documentation
```

### Key Files

- `app/index.tsx` - Main chat screen
- `app/settingsScreen.tsx` - Settings interface
- `services/mcp/client.ts` - MCP client implementation
- `services/chat/unified-mcp.ts` - Chat with MCP integration
- `components/ui/settings/MCPServerSettings.tsx` - MCP settings UI

### Development Tips

1. **Start Simple**: Test basic connectivity before complex features
2. **Use Debug Logs**: Enable console logging for troubleshooting
3. **Test Incrementally**: Verify each component independently
4. **Handle Errors**: Implement comprehensive error handling
5. **Document Changes**: Update wiki for new features

---

## Community

### Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)
- [Cactus Framework](https://github.com/cactus-compute/cactus)

### Join the Cactus Community

- [Discord community](https://discord.gg/nPGWGxXSwr): Chat with Cactus developers and ask questions

---

## Appendix

### Known Limitations

- Tool calling requires specific models (Hammer, Llama Tool Calling)
- SSE connections may timeout after idle periods
- Mobile platforms restrict background process management
- External servers must be managed by users

### Security Considerations

- Validate all tool inputs and outputs
- Implement user confirmation for sensitive actions
- Use secure connections (HTTPS) when possible
- Never expose API keys in code or logs

### Future Enhancements

- Native MCP server embedding
- Enhanced tool UI components
- Multi-turn tool conversations
- Tool result caching
- Offline tool simulation

---

*Last updated: September 2, 2025*
*Version: 1.1.1*