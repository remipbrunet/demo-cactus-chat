// MCP Client Service with SSE Support for React Native
import EventSource from 'react-native-sse';
import {
  MCPServer,
  MCPTool,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPInitializeRequest,
  MCPListToolsRequest,
  MCPCallToolRequest,
  MCPToolInvocation,
} from './types';

class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  private connections: Map<string, EventSource> = new Map();
  private sessionIds: Map<string, string> = new Map(); // Track SSE session IDs
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestId = 0;
  private onStatusChange?: (serverId: string, status: MCPServer['status']) => void;

  constructor() {
    console.log('[MCPClient] Initialized');
  }

  setStatusChangeHandler(handler: (serverId: string, status: MCPServer['status']) => void) {
    this.onStatusChange = handler;
  }

  private updateServerStatus(serverId: string, status: MCPServer['status'], errorMessage?: string) {
    const server = this.servers.get(serverId);
    if (server) {
      server.status = status;
      if (errorMessage) {
        server.errorMessage = errorMessage;
      } else {
        delete server.errorMessage;
      }
      this.servers.set(serverId, server);
      this.onStatusChange?.(serverId, status);
    }
  }

  async connectToServer(server: MCPServer): Promise<void> {
    console.log(`[MCPClient] Connecting to server: ${server.name} at ${server.url}`);
    
    // Store server configuration
    this.servers.set(server.id, { ...server, status: 'connecting' });
    this.updateServerStatus(server.id, 'connecting');

    try {
      // For SSE endpoint, we'll use EventSource for streaming
      // For HTTP endpoint, we'll use regular fetch
      const isSSE = server.url.includes('/sse');
      
      if (isSSE) {
        await this.connectSSE(server);
      } else {
        await this.connectHTTP(server);
      }
      
      // Initialize the connection
      await this.initialize(server.id);
      
      // List available tools
      const tools = await this.listTools(server.id);
      const updatedServer = this.servers.get(server.id);
      if (updatedServer) {
        updatedServer.tools = tools;
        updatedServer.lastConnected = new Date();
        this.servers.set(server.id, updatedServer);
      }
      
      this.updateServerStatus(server.id, 'connected');
      console.log(`[MCPClient] Connected to ${server.name} with ${tools.length} tools`);
    } catch (error) {
      console.error(`[MCPClient] Failed to connect to ${server.name}:`, error);
      this.updateServerStatus(server.id, 'error', error instanceof Error ? error.message : 'Connection failed');
      throw error;
    }
  }

  private async connectSSE(server: MCPServer): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (server.apiKey) {
        headers['CONTEXT7_API_KEY'] = server.apiKey;
      }

      const eventSource = new EventSource(server.url, {
        headers,
        withCredentials: false,
      });

      eventSource.addEventListener('open', () => {
        console.log(`[MCPClient] SSE connection opened for ${server.name}`);
        this.connections.set(server.id, eventSource);
        
        // Extract session ID from the SSE connection
        // Context7 sends the session ID in the first message or we can extract from headers
        // For now, we'll generate a unique session ID
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.sessionIds.set(server.id, sessionId);
        console.log(`[MCPClient] Session ID for ${server.name}: ${sessionId}`);
        
        resolve();
      });

      eventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a session ID message from Context7
          if (data.sessionId) {
            this.sessionIds.set(server.id, data.sessionId);
            console.log(`[MCPClient] Received session ID for ${server.name}: ${data.sessionId}`);
          } else {
            this.handleResponse(server.id, data);
          }
        } catch (error) {
          console.error('[MCPClient] Failed to parse SSE message:', error);
        }
      });

      eventSource.addEventListener('error', (error: any) => {
        console.error(`[MCPClient] SSE error for ${server.name}:`, error);
        this.updateServerStatus(server.id, 'error', 'SSE connection error');
        reject(error);
      });

      eventSource.addEventListener('close', () => {
        console.log(`[MCPClient] SSE connection closed for ${server.name}`);
        this.updateServerStatus(server.id, 'disconnected');
      });
    });
  }

  private async connectHTTP(server: MCPServer): Promise<void> {
    // For HTTP transport, we don't maintain a persistent connection
    // Each request will be sent via fetch
    console.log(`[MCPClient] HTTP mode for ${server.name}`);
  }

  private async sendRequest(serverId: string, request: JSONRPCRequest): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const requestIdStr = `${++this.requestId}`;
    request.id = requestIdStr;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestIdStr);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestIdStr, { resolve, reject, timeout });

      const isSSE = server.url.includes('/sse');
      
      if (isSSE) {
        // For SSE with Context7, we need to send to /messages with sessionId
        const sessionId = this.sessionIds.get(serverId);
        const baseUrl = server.url.replace('/sse', '');
        const postUrl = sessionId 
          ? `${baseUrl}/messages?sessionId=${sessionId}`
          : `${baseUrl}/mcp`; // Fallback to /mcp if no session ID
        this.sendViaHTTP(postUrl, request, server.apiKey);
      } else {
        // For HTTP transport, send directly
        this.sendViaHTTP(server.url, request, server.apiKey);
      }
    });
  }

  private async sendViaHTTP(url: string, request: JSONRPCRequest, apiKey?: string): Promise<void> {
    // Context7's StreamableHTTPServerTransport requires accepting both JSON and event-stream
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    
    if (apiKey) {
      headers['CONTEXT7_API_KEY'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Context7 returns event-stream format even for single responses
      const text = await response.text();
      
      // Parse event-stream format: "event: message\ndata: {...}\n\n"
      const lines = text.split('\n');
      let jsonData = null;
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6); // Remove "data: " prefix
          try {
            jsonData = JSON.parse(dataStr);
            break;
          } catch (e) {
            console.error('[MCPClient] Failed to parse data line:', dataStr);
          }
        }
      }
      
      if (jsonData) {
        this.handleResponse('', jsonData); // serverId not needed for HTTP responses
      } else {
        throw new Error('No valid JSON data found in response');
      }
    } catch (error) {
      console.error('[MCPClient] HTTP request failed:', error);
      const pending = this.pendingRequests.get(String(request.id));
      if (pending) {
        pending.reject(error);
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(String(request.id));
      }
    }
  }

  private handleResponse(serverId: string, response: JSONRPCResponse) {
    const requestIdStr = String(response.id);
    const pending = this.pendingRequests.get(requestIdStr);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestIdStr);
      
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  private async initialize(serverId: string): Promise<void> {
    const request: MCPInitializeRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '1.0',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'CactusChat',
          version: '1.0.0',
        },
      },
      id: 0,
    };

    await this.sendRequest(serverId, request);
  }

  private async listTools(serverId: string): Promise<MCPTool[]> {
    const request: MCPListToolsRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 0,
    };

    const result = await this.sendRequest(serverId, request);
    const tools = result.tools || [];
    
    // Debug: Log the tools we received
    console.log('[MCPClient] Tools received:', JSON.stringify(tools, null, 2));
    
    return tools;
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: any
  ): Promise<MCPToolInvocation> {
    const invocation: MCPToolInvocation = {
      serverId,
      toolName,
      arguments: args,
      status: 'pending',
      startTime: new Date(),
    };

    try {
      invocation.status = 'running';
      
      const request: MCPCallToolRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
        id: 0,
      };

      const result = await this.sendRequest(serverId, request);
      
      invocation.status = 'completed';
      invocation.result = result;
      invocation.endTime = new Date();
    } catch (error) {
      invocation.status = 'error';
      invocation.error = error instanceof Error ? error.message : 'Tool call failed';
      invocation.endTime = new Date();
    }

    return invocation;
  }

  disconnectServer(serverId: string) {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.close();
      this.connections.delete(serverId);
    }
    this.updateServerStatus(serverId, 'disconnected');
  }

  disconnectAll() {
    this.connections.forEach((connection, serverId) => {
      connection.close();
      this.updateServerStatus(serverId, 'disconnected');
    });
    this.connections.clear();
  }

  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  getConnectedServers(): MCPServer[] {
    return this.getAllServers().filter(s => s.status === 'connected');
  }
}

// Singleton instance
export const mcpClient = new MCPClient();