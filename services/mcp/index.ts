/**
 * MCP Service Layer - Main exports for Model Context Protocol integration
 * Provides complete MCP client functionality for Cactus Chat
 */

// Core MCP Client exports
export { MCPClient, MCPClientManager } from './client';
export { MCPTransportFactory, MCPHttpTransport, MCPWebSocketTransport } from './transport';

// Type exports
export type {
  // JSON-RPC types
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,

  // MCP Protocol types
  MCPCapabilities,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPClientConfig,
  MCPConnectionState,
  MCPConnectionEvents,

  // Resource types
  MCPResource,
  MCPResourceContent,
  MCPResourceTemplate,

  // Tool types
  MCPTool,
  MCPToolParameter,
  MCPToolCall,
  MCPToolResult,

  // Sampling types
  MCPSamplingMessage,
  MCPCreateMessageRequest,
  MCPCreateMessageResult,

  // Logging types
  MCPLogLevel,
  MCPLogEntry,

  // Transport types
  MCPTransportConfig,
  MCPHttpConfig,
  MCPWebSocketConfig,
} from './types';

export { MCPErrorCode } from './types';

// Transport interface
export type { MCPTransport } from './transport';

/**
 * MCP Service - High-level service wrapper for easy integration
 */
import { MCPClient, MCPClientManager } from './client';
import { 
  MCPClientConfig, 
  MCPResource, 
  MCPTool, 
  MCPToolResult, 
  MCPResourceContent,
  MCPConnectionState
} from './types';

export interface MCPServiceConfig {
  servers: Array<{
    id: string;
    name: string;
    config: MCPClientConfig;
    autoConnect?: boolean;
  }>;
  defaultServerId?: string;
  debug?: boolean;
}

/**
 * High-level MCP Service for easy integration with Cactus Chat
 */
export class MCPService {
  private manager: MCPClientManager;
  private config: MCPServiceConfig;
  private eventListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  constructor(config: MCPServiceConfig) {
    this.config = config;
    this.manager = new MCPClientManager();
    this.setupClients();
  }

  private setupClients(): void {
    for (const serverConfig of this.config.servers) {
      const client = this.manager.addClient(serverConfig.id, serverConfig.config);
      
      // Forward events with server ID context
      client.on('state-change', (state: any) => {
        this.emit('server-state-change', { serverId: serverConfig.id, state });
      });

      client.on('error', (error: any) => {
        this.emit('server-error', { serverId: serverConfig.id, error });
      });

      client.on('resource-update', (uri: any) => {
        this.emit('resource-update', { serverId: serverConfig.id, uri });
      });

      client.on('tool-update', () => {
        this.emit('tool-update', { serverId: serverConfig.id });
      });

      client.on('log', (entry: any) => {
        this.emit('log', { serverId: serverConfig.id, entry });
      });
    }
  }

  /**
   * Initialize all configured MCP servers
   */
  async initialize(): Promise<void> {
    const autoConnectClients = this.config.servers.filter(s => s.autoConnect !== false);
    
    const connectionPromises = autoConnectClients.map(async (serverConfig) => {
      try {
        const client = this.manager.getClient(serverConfig.id);
        if (client) {
          await client.connect();
          if (this.config.debug) {
            console.log(`Connected to MCP server: ${serverConfig.name}`);
          }
        }
      } catch (error) {
        console.error(`Failed to connect to MCP server ${serverConfig.name}:`, error);
        // Don't throw - allow other servers to connect
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Shutdown all MCP connections
   */
  async shutdown(): Promise<void> {
    await this.manager.disconnectAll();
  }

  /**
   * Get all available resources from all connected servers
   */
  async getAvailableResources(): Promise<Array<MCPResource & { serverId: string; serverName: string }>> {
    const resources = await this.manager.getAllResources();
    return resources.map(resource => {
      const serverConfig = this.config.servers.find(s => s.id === resource.clientId);
      return {
        ...resource,
        serverId: resource.clientId,
        serverName: serverConfig?.name || 'Unknown',
      };
    });
  }

  /**
   * Get all available tools from all connected servers
   */
  async getAvailableTools(): Promise<Array<MCPTool & { serverId: string; serverName: string }>> {
    const tools = await this.manager.getAllTools();
    return tools.map(tool => {
      const serverConfig = this.config.servers.find(s => s.id === tool.clientId);
      return {
        ...tool,
        serverId: tool.clientId,
        serverName: serverConfig?.name || 'Unknown',
      };
    });
  }

  /**
   * Read content from a resource
   */
  async readResource(serverId: string, uri: string): Promise<MCPResourceContent> {
    const client = this.manager.getClient(serverId);
    if (!client || !client.isReady()) {
      throw new Error(`MCP server ${serverId} is not connected`);
    }

    return await client.readResource(uri);
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, toolName: string, arguments_: Record<string, any>): Promise<MCPToolResult> {
    const client = this.manager.getClient(serverId);
    if (!client || !client.isReady()) {
      throw new Error(`MCP server ${serverId} is not connected`);
    }

    return await client.callTool(toolName, arguments_);
  }

  /**
   * Find and call a tool by name (searches all servers)
   */
  async findAndCallTool(toolName: string, arguments_: Record<string, any>): Promise<MCPToolResult & { serverId: string }> {
    const tools = await this.getAvailableTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const result = await this.callTool(tool.serverId, toolName, arguments_);
    return { ...result, serverId: tool.serverId };
  }

  /**
   * Get all servers that provide a specific tool
   */
  async getServersForTool(toolName: string): Promise<string[]> {
    try {
      const tools = await this.getAvailableTools();
      const serversWithTool = tools
        .filter(tool => tool.name === toolName)
        .map(tool => tool.serverId);
      
      // Remove duplicates and return only connected servers
      const uniqueServerIds = Array.from(new Set(serversWithTool));
      const connectedServers = uniqueServerIds.filter(serverId => {
        const client = this.manager.getClient(serverId);
        return client && client.isReady();
      });
      
      return connectedServers;
    } catch (error) {
      console.error(`Failed to get servers for tool ${toolName}:`, error);
      return [];
    }
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): Array<{
    serverId: string;
    serverName: string;
    state: MCPConnectionState;
    isReady: boolean;
  }> {
    return this.config.servers.map(serverConfig => {
      const client = this.manager.getClient(serverConfig.id);
      return {
        serverId: serverConfig.id,
        serverName: serverConfig.name,
        state: client?.state || MCPConnectionState.DISCONNECTED,
        isReady: client?.isReady() || false,
      };
    });
  }

  /**
   * Get a specific client by server ID
   */
  getClient(serverId: string): MCPClient | undefined {
    return this.manager.getClient(serverId);
  }

  /**
   * Connect to a specific server
   */
  async connectToServer(serverId: string): Promise<void> {
    const client = this.manager.getClient(serverId);
    if (!client) {
      throw new Error(`MCP server ${serverId} not configured`);
    }

    await client.connect();
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.manager.getClient(serverId);
    if (client) {
      await client.disconnect();
    }
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeToResource(serverId: string, uri: string): Promise<void> {
    const client = this.manager.getClient(serverId);
    if (!client || !client.isReady()) {
      throw new Error(`MCP server ${serverId} is not connected`);
    }

    await client.subscribeToResource(uri);
  }

  /**
   * Event handling
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Check if the service is ready (has connected servers)
   */
  isReady(): boolean {
    const clients = this.manager.getAllClients();
    return clients.some(client => client.isReady());
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Default MCP service instance for easy import
 */
let defaultMCPService: MCPService | null = null;

/**
 * Initialize the default MCP service
 */
export function initializeMCPService(config: MCPServiceConfig): MCPService {
  defaultMCPService = new MCPService(config);
  return defaultMCPService;
}

/**
 * Get the default MCP service instance
 */
export function getMCPService(): MCPService {
  if (!defaultMCPService) {
    throw new Error('MCP Service not initialized. Call initializeMCPService() first.');
  }
  return defaultMCPService;
}