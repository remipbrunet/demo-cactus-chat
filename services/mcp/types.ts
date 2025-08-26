/**
 * MCP (Model Context Protocol) Type Definitions
 * Implementation of JSON-RPC 2.0 specification for MCP
 */

// JSON-RPC 2.0 Base Types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id?: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Protocol Specific Types
export interface MCPCapabilities {
  sampling?: {
    supports_completion?: boolean;
    supports_streaming?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    list_changed?: boolean;
  };
  tools?: {
    list_changed?: boolean;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warning' | 'error';
  };
}

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

// MCP Resource Types
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// MCP Tool Types
export interface MCPToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  properties?: Record<string, MCPToolParameter>;
  items?: MCPToolParameter;
  enum?: any[];
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPToolParameter>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// MCP Sampling Types
export interface MCPSamplingMessage {
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text';
    text: string;
  };
}

export interface MCPCreateMessageRequest {
  messages: MCPSamplingMessage[];
  modelPreferences?: {
    hints?: Array<{
      name?: string;
    }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

export interface MCPCreateMessageResult {
  content: {
    type: 'text';
    text: string;
  };
  model: string;
  role: 'assistant';
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

// MCP Logging Types
export type MCPLogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface MCPLogEntry {
  level: MCPLogLevel;
  message: string;
  data?: any;
  logger?: string;
}

// MCP Error Codes (following JSON-RPC 2.0)
export enum MCPErrorCode {
  // Standard JSON-RPC errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // MCP specific errors
  INVALID_PROTOCOL_VERSION = -32001,
  RESOURCE_NOT_FOUND = -32002,
  RESOURCE_ACCESS_DENIED = -32003,
  TOOL_NOT_FOUND = -32004,
  TOOL_EXECUTION_ERROR = -32005,
  CONNECTION_LOST = -32006,
  INITIALIZATION_FAILED = -32007,
}

// Transport Configuration Types
export interface MCPTransportConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface MCPHttpConfig extends MCPTransportConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface MCPWebSocketConfig extends MCPTransportConfig {
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
  autoReconnect?: boolean;
}

// Connection States
export enum MCPConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  INITIALIZED = 'initialized',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

// Event Types for Connection Management
export interface MCPConnectionEvents {
  'state-change': (state: MCPConnectionState) => void;
  'error': (error: Error) => void;
  'resource-update': (uri: string) => void;
  'tool-update': () => void;
  'log': (entry: MCPLogEntry) => void;
  'notification': (notification: JsonRpcNotification) => void;
}

// Client Configuration
export interface MCPClientConfig {
  name: string;
  version: string;
  capabilities?: MCPCapabilities;
  transport: 'http' | 'websocket';
  config: MCPHttpConfig | MCPWebSocketConfig;
  autoReconnect?: boolean;
  debug?: boolean;
}