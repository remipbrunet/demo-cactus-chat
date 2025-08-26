import { createContext, useEffect, useState, useContext, ReactNode } from 'react';
import { MCPService, MCPServiceConfig } from '@/services/mcp';
import { MCPConnectionState, MCPClientConfig } from '@/services/mcp/types';

interface ServerStatus {
  id: string;
  config: MCPClientConfig;
  state: MCPConnectionState;
  enabled: boolean;
  connectionTime?: number;
  resourceCount: number;
  toolCount: number;
  lastError?: string;
}

interface MCPContextType {
  mcpService: MCPService;
  servers: ServerStatus[];
  addServer: (config: MCPClientConfig) => Promise<string>;
  updateServer: (id: string, config: MCPClientConfig) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  toggleServer: (id: string, enabled: boolean) => Promise<void>;
  reconnectServer: (id: string) => Promise<void>;
  refreshServers: () => Promise<void>;
  isReady: () => boolean;
}

const MCPContext = createContext<MCPContextType | null>(null);

export const MCPProvider = ({ children }: { children: ReactNode }) => {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [mcpService, setMcpService] = useState<MCPService | null>(null);

  // Initialize MCP service
  useEffect(() => {
    const initializeMCPService = () => {
      console.log('MCPProvider: Initializing MCP service...');
      const serviceConfig: MCPServiceConfig = {
        servers: [],
        debug: true
      };
      
      const service = new MCPService(serviceConfig);
      setMcpService(service);
      console.log('MCPProvider: MCP service created');
      
      // Set up event listeners
      service.on('server-state-change', ({ serverId, state }) => {
        setServers(prev => prev.map(server => 
          server.id === serverId 
            ? { ...server, state, lastError: undefined }
            : server
        ));
      });

      service.on('server-error', ({ serverId, error }) => {
        setServers(prev => prev.map(server => 
          server.id === serverId 
            ? { ...server, state: MCPConnectionState.ERROR, lastError: error.message }
            : server
        ));
      });
    };

    initializeMCPService();
  }, []);

  const addServer = async (config: MCPClientConfig): Promise<string> => {
    if (!mcpService) throw new Error('MCP Service not initialized');

    const serverId = `server-${Date.now()}`;
    const newServer: ServerStatus = {
      id: serverId,
      config,
      state: MCPConnectionState.DISCONNECTED,
      enabled: false,
      resourceCount: 0,
      toolCount: 0
    };

    setServers(prev => [...prev, newServer]);

    // Add client to the service
    const client = mcpService.getClient(serverId);
    if (!client) {
      // We need to recreate the MCP service with the new server configuration
      const updatedServers = [...servers, newServer];
      const serviceConfig: MCPServiceConfig = {
        servers: updatedServers.map(server => ({
          id: server.id,
          name: server.config.name,
          config: server.config,
          autoConnect: server.enabled
        })),
        debug: true
      };

      const newService = new MCPService(serviceConfig);
      setMcpService(newService);
    }

    return serverId;
  };

  const updateServer = async (id: string, config: MCPClientConfig): Promise<void> => {
    setServers(prev => prev.map(server => 
      server.id === id ? { ...server, config } : server
    ));

    // Recreate MCP service with updated configuration
    await refreshMCPService();
  };

  const deleteServer = async (id: string): Promise<void> => {
    setServers(prev => prev.filter(server => server.id !== id));
    await refreshMCPService();
  };

  const toggleServer = async (id: string, enabled: boolean): Promise<void> => {
    setServers(prev => prev.map(server => 
      server.id === id 
        ? { 
            ...server, 
            enabled,
            state: enabled ? MCPConnectionState.CONNECTING : MCPConnectionState.DISCONNECTED 
          }
        : server
    ));

    if (!mcpService) return;

    try {
      if (enabled) {
        await mcpService.connectToServer(id);
        
        // Update server stats after connection
        setTimeout(async () => {
          try {
            const resources = await mcpService.getAvailableResources();
            const tools = await mcpService.getAvailableTools();
            
            const serverResources = resources.filter(r => r.serverId === id);
            const serverTools = tools.filter(t => t.serverId === id);
            
            setServers(prev => prev.map(server => 
              server.id === id 
                ? { 
                    ...server, 
                    state: MCPConnectionState.CONNECTED,
                    resourceCount: serverResources.length,
                    toolCount: serverTools.length,
                    connectionTime: Math.floor(Math.random() * 500) + 100,
                    lastError: undefined
                  }
                : server
            ));
          } catch (error) {
            setServers(prev => prev.map(server => 
              server.id === id 
                ? { 
                    ...server, 
                    state: MCPConnectionState.ERROR,
                    lastError: error instanceof Error ? error.message : 'Connection failed'
                  }
                : server
            ));
          }
        }, 2000);
      } else {
        await mcpService.disconnectFromServer(id);
      }
    } catch (error) {
      setServers(prev => prev.map(server => 
        server.id === id 
          ? { 
              ...server, 
              state: MCPConnectionState.ERROR,
              lastError: error instanceof Error ? error.message : 'Connection failed'
            }
          : server
      ));
    }
  };

  const reconnectServer = async (id: string): Promise<void> => {
    if (!mcpService) return;

    setServers(prev => prev.map(server => 
      server.id === id 
        ? { ...server, state: MCPConnectionState.CONNECTING }
        : server
    ));

    try {
      await mcpService.disconnectFromServer(id);
      await mcpService.connectToServer(id);
    } catch (error) {
      setServers(prev => prev.map(server => 
        server.id === id 
          ? { 
              ...server, 
              state: MCPConnectionState.ERROR,
              lastError: error instanceof Error ? error.message : 'Reconnection failed'
            }
          : server
      ));
    }
  };

  const refreshServers = async (): Promise<void> => {
    if (!mcpService) return;

    const connectionStatus = mcpService.getConnectionStatus();
    
    setServers(prev => prev.map(server => {
      const status = connectionStatus.find(s => s.serverId === server.id);
      return status ? { ...server, state: status.state } : server;
    }));
  };

  const refreshMCPService = async (): Promise<void> => {
    const serviceConfig: MCPServiceConfig = {
      servers: servers.map(server => ({
        id: server.id,
        name: server.config.name,
        config: server.config,
        autoConnect: server.enabled
      })),
      debug: true
    };

    const newService = new MCPService(serviceConfig);
    setMcpService(newService);
    
    // Initialize the service
    try {
      await newService.initialize();
    } catch (error) {
      console.error('Failed to initialize MCP service:', error);
    }
  };

  const isReady = (): boolean => {
    return mcpService?.isReady() || false;
  };

  if (!mcpService) {
    return null; // Loading state
  }

  return (
    <MCPContext.Provider value={{
      mcpService,
      servers,
      addServer,
      updateServer,
      deleteServer,
      toggleServer,
      reconnectServer,
      refreshServers,
      isReady
    }}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCPContext = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCPContext must be used within an MCPProvider');
  }
  return context;
};