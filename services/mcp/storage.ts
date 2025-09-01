// MCP Server Configuration Storage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MCPServer } from './types';

const STORAGE_KEY = 'mcp_servers';

export class MCPStorage {
  static async saveServers(servers: MCPServer[]): Promise<void> {
    try {
      // Don't save transient state like status or error messages
      const serversToSave = servers.map(server => ({
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
        apiKey: server.apiKey,
        enabled: server.enabled,
      }));
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serversToSave));
      console.log('[MCPStorage] Saved', serversToSave.length, 'servers');
    } catch (error) {
      console.error('[MCPStorage] Failed to save servers:', error);
    }
  }

  static async loadServers(): Promise<MCPServer[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        // Return default Context7 server for testing
        return [
          {
            id: 'context7-local',
            name: 'Context7 (Local)',
            url: 'http://192.168.10.107:3000/mcp',
            description: 'Local Context7 MCP server for documentation',
            enabled: true,
            status: 'disconnected',
          },
        ];
      }
      
      const servers = JSON.parse(data);
      // Add default status to loaded servers
      return servers.map((server: any) => ({
        ...server,
        status: 'disconnected',
      }));
    } catch (error) {
      console.error('[MCPStorage] Failed to load servers:', error);
      return [];
    }
  }

  static async addServer(server: Omit<MCPServer, 'id' | 'status'>): Promise<MCPServer> {
    const servers = await this.loadServers();
    const newServer: MCPServer = {
      ...server,
      id: `mcp-${Date.now()}`,
      status: 'disconnected',
    };
    
    servers.push(newServer);
    await this.saveServers(servers);
    return newServer;
  }

  static async updateServer(serverId: string, updates: Partial<MCPServer>): Promise<void> {
    const servers = await this.loadServers();
    const index = servers.findIndex(s => s.id === serverId);
    
    if (index !== -1) {
      servers[index] = { ...servers[index], ...updates };
      await this.saveServers(servers);
    }
  }

  static async deleteServer(serverId: string): Promise<void> {
    const servers = await this.loadServers();
    const filtered = servers.filter(s => s.id !== serverId);
    await this.saveServers(filtered);
  }
}