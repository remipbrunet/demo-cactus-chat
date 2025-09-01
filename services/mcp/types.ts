// MCP Protocol Types for Mobile Implementation

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  description?: string;
  apiKey?: string;
  enabled: boolean;
  tools?: MCPTool[];
  lastConnected?: Date;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  errorMessage?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

// JSON-RPC 2.0 Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JSONRPCError;
  id: string | number;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

// MCP Protocol Messages
export interface MCPInitializeRequest extends JSONRPCRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: boolean;
      resources?: boolean;
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPListToolsRequest extends JSONRPCRequest {
  method: 'tools/list';
}

export interface MCPCallToolRequest extends JSONRPCRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: any;
  };
}

// Tool-specific types for Context7
export interface Context7ResolveLibraryParams {
  libraryName: string;
}

export interface Context7GetDocsParams {
  context7CompatibleLibraryID: string;
  topic?: string;
  tokens?: number;
}

// Chat Integration Types
export interface MCPToolInvocation {
  serverId: string;
  toolName: string;
  arguments: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface MCPEnabledMessage {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: MCPToolInvocation[];
  reasoning?: string;
}