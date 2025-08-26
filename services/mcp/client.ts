/**
 * MCP JSON-RPC 2.0 Client Implementation
 * Full implementation of the Model Context Protocol specification
 */

// Simple EventEmitter implementation for React Native compatibility
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  removeListener(event: string, callback: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  MCPClientConfig,
  MCPConnectionState,
  MCPCapabilities,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPResource,
  MCPResourceContent,
  MCPResourceTemplate,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPCreateMessageRequest,
  MCPCreateMessageResult,
  MCPLogLevel,
  MCPLogEntry,
  MCPErrorCode,
  MCPConnectionEvents
} from './types';
import { MCPTransport, MCPTransportFactory } from './transport';

/**
 * MCP Client - Complete JSON-RPC 2.0 implementation
 */
export class MCPClient extends SimpleEventEmitter {
  private transport: MCPTransport;
  private config: MCPClientConfig;
  private _state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private serverCapabilities: MCPCapabilities = {};
  private serverInfo: { name: string; version: string } = { name: '', version: '' };
  private availableResources: MCPResource[] = [];
  private availableTools: MCPTool[] = [];
  private resourceTemplates: MCPResourceTemplate[] = [];
  private isInitialized = false;

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    this.transport = config.transport === 'http' 
      ? MCPTransportFactory.create('http', config.config as any)
      : MCPTransportFactory.create('websocket', config.config as any);
    this.setupTransportListeners();
  }

  get state(): MCPConnectionState {
    return this._state;
  }

  get capabilities(): MCPCapabilities {
    return this.serverCapabilities;
  }

  get resources(): MCPResource[] {
    return [...this.availableResources];
  }

  get tools(): MCPTool[] {
    return [...this.availableTools];
  }

  get templates(): MCPResourceTemplate[] {
    return [...this.resourceTemplates];
  }

  private setState(state: MCPConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('state-change', state);
    }
  }

  private setupTransportListeners(): void {
    this.transport.onStateChange((state) => {
      this.setState(state);
    });

    this.transport.onError((error) => {
      this.emit('error', error);
    });

    this.transport.onNotification((notification) => {
      this.handleNotification(notification);
    });
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;

    switch (method) {
      case 'notifications/resources/list_changed':
        this.handleResourceListChanged();
        break;

      case 'notifications/resources/updated':
        if (params?.uri) {
          this.emit('resource-update', params.uri);
        }
        break;

      case 'notifications/tools/list_changed':
        this.handleToolListChanged();
        break;

      case 'notifications/logging/message':
        if (params) {
          this.emit('log', params as MCPLogEntry);
        }
        break;

      default:
        if (this.config.debug) {
          console.log('Received unknown notification:', notification);
        }
        this.emit('notification', notification);
        break;
    }
  }

  private async handleResourceListChanged(): Promise<void> {
    try {
      await this.refreshResources();
      if (this.config.debug) {
        console.log('Resource list refreshed after change notification');
      }
    } catch (error) {
      console.error('Failed to refresh resources after change notification:', error);
    }
  }

  private async handleToolListChanged(): Promise<void> {
    try {
      await this.refreshTools();
      this.emit('tool-update');
      if (this.config.debug) {
        console.log('Tool list refreshed after change notification');
      }
    } catch (error) {
      console.error('Failed to refresh tools after change notification:', error);
    }
  }

  /**
   * Connect to the MCP server and initialize the session
   */
  async connect(): Promise<void> {
    try {
      // Connect transport
      await this.transport.connect();

      // Initialize MCP session
      await this.initialize();

      // Mark as initialized before refreshing resources/tools
      this.isInitialized = true;
      this.setState(MCPConnectionState.INITIALIZED);

      // Load initial resources and tools
      await this.refreshResources();
      await this.refreshTools();

      if (this.config.debug) {
        console.log('MCP Client initialized successfully');
      }
    } catch (error) {
      this.setState(MCPConnectionState.ERROR);
      const initError = new Error(`MCP Client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emit('error', initError);
      throw initError;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    this.isInitialized = false;
    await this.transport.disconnect();
    this.setState(MCPConnectionState.DISCONNECTED);
  }

  /**
   * Initialize MCP session with capabilities negotiation
   */
  private async initialize(): Promise<MCPInitializeResult> {
    const initializeParams: MCPInitializeParams = {
      protocolVersion: '2024-11-05',
      capabilities: this.config.capabilities || {
        sampling: {
          supports_completion: true,
          supports_streaming: true,
        },
        resources: {
          subscribe: true,
          list_changed: true,
        },
        tools: {
          list_changed: true,
        },
        logging: {
          level: 'info',
        },
      },
      clientInfo: {
        name: this.config.name,
        version: this.config.version,
      },
    };

    const response = await this.sendRequest('initialize', initializeParams);
    
    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    const result: MCPInitializeResult = response.result;
    this.serverCapabilities = result.capabilities;
    this.serverInfo = result.serverInfo;

    // Send initialized notification
    await this.sendNotification('notifications/initialized');

    return result;
  }

  /**
   * List available resources from the server
   */
  async listResources(): Promise<MCPResource[]> {
    this.ensureInitialized();

    const response = await this.sendRequest('resources/list');
    
    if (response.error) {
      throw new Error(`List resources failed: ${response.error.message}`);
    }

    return response.result?.resources || [];
  }

  /**
   * Read content from a specific resource
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    this.ensureInitialized();

    const response = await this.sendRequest('resources/read', { uri });
    
    if (response.error) {
      if (response.error.code === MCPErrorCode.RESOURCE_NOT_FOUND) {
        throw new Error(`Resource not found: ${uri}`);
      }
      throw new Error(`Read resource failed: ${response.error.message}`);
    }

    return response.result?.contents?.[0] || { uri };
  }

  /**
   * Subscribe to resource updates (if supported)
   */
  async subscribeToResource(uri: string): Promise<void> {
    this.ensureInitialized();

    if (!this.serverCapabilities.resources?.subscribe) {
      throw new Error('Server does not support resource subscriptions');
    }

    const response = await this.sendRequest('resources/subscribe', { uri });
    
    if (response.error) {
      throw new Error(`Subscribe to resource failed: ${response.error.message}`);
    }
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeFromResource(uri: string): Promise<void> {
    this.ensureInitialized();

    const response = await this.sendRequest('resources/unsubscribe', { uri });
    
    if (response.error) {
      throw new Error(`Unsubscribe from resource failed: ${response.error.message}`);
    }
  }

  /**
   * List available resource templates
   */
  async listResourceTemplates(): Promise<MCPResourceTemplate[]> {
    this.ensureInitialized();

    const response = await this.sendRequest('resources/templates/list');
    
    if (response.error) {
      throw new Error(`List resource templates failed: ${response.error.message}`);
    }

    return response.result?.resourceTemplates || [];
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPTool[]> {
    this.ensureInitialized();

    const response = await this.sendRequest('tools/list');
    
    if (response.error) {
      throw new Error(`List tools failed: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  /**
   * Call a tool with the specified arguments
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPToolResult> {
    this.ensureInitialized();

    const toolCall: MCPToolCall = {
      name,
      arguments: arguments_,
    };

    const response = await this.sendRequest('tools/call', toolCall);
    
    if (response.error) {
      if (response.error.code === MCPErrorCode.TOOL_NOT_FOUND) {
        throw new Error(`Tool not found: ${name}`);
      }
      if (response.error.code === MCPErrorCode.TOOL_EXECUTION_ERROR) {
        throw new Error(`Tool execution failed: ${response.error.message}`);
      }
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Create a message using the server's sampling capabilities
   */
  async createMessage(request: MCPCreateMessageRequest): Promise<MCPCreateMessageResult> {
    this.ensureInitialized();

    if (!this.serverCapabilities.sampling?.supports_completion) {
      throw new Error('Server does not support message creation');
    }

    const response = await this.sendRequest('sampling/createMessage', request);
    
    if (response.error) {
      throw new Error(`Create message failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Send a log message to the server
   */
  async logMessage(level: MCPLogLevel, message: string, data?: any): Promise<void> {
    this.ensureInitialized();

    const logEntry: MCPLogEntry = {
      level,
      message,
      data,
      logger: this.config.name,
    };

    await this.sendNotification('notifications/logging/message', logEntry);
  }

  /**
   * Refresh the local cache of available resources
   */
  async refreshResources(): Promise<void> {
    try {
      const resources = await this.listResources();
      this.availableResources = resources;
      
      // Also refresh templates if supported
      try {
        const templates = await this.listResourceTemplates();
        this.resourceTemplates = templates;
      } catch (error) {
        // Templates might not be supported
        if (this.config.debug) {
          console.log('Resource templates not supported or failed to load:', error);
        }
      }
    } catch (error) {
      console.error('Failed to refresh resources:', error);
      throw error;
    }
  }

  /**
   * Refresh the local cache of available tools
   */
  async refreshTools(): Promise<void> {
    try {
      const tools = await this.listTools();
      this.availableTools = tools;
    } catch (error) {
      console.error('Failed to refresh tools:', error);
      throw error;
    }
  }

  /**
   * Find a tool by name
   */
  findTool(name: string): MCPTool | undefined {
    return this.availableTools.find(tool => tool.name === name);
  }

  /**
   * Find a resource by URI
   */
  findResource(uri: string): MCPResource | undefined {
    return this.availableResources.find(resource => resource.uri === uri);
  }

  /**
   * Get server information
   */
  getServerInfo(): { name: string; version: string; capabilities: MCPCapabilities } {
    return {
      name: this.serverInfo.name,
      version: this.serverInfo.version,
      capabilities: this.serverCapabilities,
    };
  }

  /**
   * Check if the client is ready for operations
   */
  isReady(): boolean {
    return this.isInitialized && this._state === MCPConnectionState.INITIALIZED;
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest(method: string, params?: any): Promise<JsonRpcResponse> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };

    try {
      return await this.transport.sendRequest(request);
    } catch (error) {
      if (this.config.debug) {
        console.error(`Request failed (${method}):`, error);
      }
      throw error;
    }
  }

  /**
   * Send a JSON-RPC notification
   */
  private async sendNotification(method: string, params?: any): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    try {
      await this.transport.sendNotification(notification);
    } catch (error) {
      if (this.config.debug) {
        console.error(`Notification failed (${method}):`, error);
      }
      throw error;
    }
  }

  /**
   * Ensure the client is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || this._state !== MCPConnectionState.INITIALIZED) {
      throw new Error('MCP Client not initialized. Call connect() first.');
    }
  }
}

/**
 * MCP Client Manager - Handles multiple MCP server connections
 */
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private defaultClientId?: string;

  /**
   * Add a new MCP client
   */
  addClient(id: string, config: MCPClientConfig): MCPClient {
    const client = new MCPClient(config);
    this.clients.set(id, client);
    
    if (!this.defaultClientId) {
      this.defaultClientId = id;
    }

    return client;
  }

  /**
   * Remove an MCP client
   */
  async removeClient(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
      
      if (this.defaultClientId === id) {
        this.defaultClientId = this.clients.size > 0 ? this.clients.keys().next().value : undefined;
      }
    }
  }

  /**
   * Get a client by ID
   */
  getClient(id?: string): MCPClient | undefined {
    const clientId = id || this.defaultClientId;
    return clientId ? this.clients.get(clientId) : undefined;
  }

  /**
   * Get all clients
   */
  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Connect all clients
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client => client.connect());
    await Promise.allSettled(promises);
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client => client.disconnect());
    await Promise.allSettled(promises);
  }

  /**
   * Get aggregated resources from all connected clients
   */
  async getAllResources(): Promise<Array<MCPResource & { clientId: string }>> {
    const resources: Array<MCPResource & { clientId: string }> = [];
    
    for (const [clientId, client] of this.clients) {
      if (client.isReady()) {
        try {
          const clientResources = await client.listResources();
          resources.push(...clientResources.map(resource => ({ ...resource, clientId })));
        } catch (error) {
          console.error(`Failed to get resources from client ${clientId}:`, error);
        }
      }
    }

    return resources;
  }

  /**
   * Get aggregated tools from all connected clients
   */
  async getAllTools(): Promise<Array<MCPTool & { clientId: string }>> {
    const tools: Array<MCPTool & { clientId: string }> = [];
    
    for (const [clientId, client] of this.clients) {
      if (client.isReady()) {
        try {
          const clientTools = await client.listTools();
          tools.push(...clientTools.map(tool => ({ ...tool, clientId })));
        } catch (error) {
          console.error(`Failed to get tools from client ${clientId}:`, error);
        }
      }
    }

    return tools;
  }
}