import { useState, useEffect } from 'react';
import { ScrollView, YStack, Button, Text } from 'tamagui';
import { Plus, Server, RefreshCw } from '@tamagui/lucide-icons';
import { Alert } from 'react-native';

import OnboardingScreenLayout from '@/components/ui/onboarding/OnboardingScreenLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { RegularText } from '@/components/ui/RegularText';
import { MCPServerCard } from '@/components/ui/mcp/MCPServerCard';
import { MCPConnectionIndicator } from '@/components/ui/mcp/MCPConnectionIndicator';
import { MCPServerConfigDialog } from '@/components/ui/mcp/MCPServerConfigDialog';
import { useMCPContext } from '@/contexts/mcpContext';

import { MCPConnectionState, MCPClientConfig } from '@/services/mcp/types';

export default function MCPServerScreen() {
  // Use shared MCP context
  const {
    servers,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
    reconnectServer,
    refreshServers
  } = useMCPContext();
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize with Microsoft Docs server as default when context is ready
  useEffect(() => {
    if (servers.length === 0 && addServer) {
      initializeDefaultServer();
    }
  }, [servers, addServer]);

  const initializeDefaultServer = async () => {
    if (servers.length === 0) {
      // Add Microsoft Docs MCP server as default
      try {
        await addServer({
          name: 'Microsoft Docs',
          version: '1.0.0',
          transport: 'http',
          debug: true,
          config: {
            baseUrl: 'https://learn.microsoft.com/api/mcp',
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'User-Agent': 'CactusChat/1.0 (Model Context Protocol Client)',
              'X-MCP-Version': '2024-11-05'
            }
          }
        });
      } catch (error) {
        console.log('Could not add default Microsoft Docs server:', error);
      }
    }
  };

  const handleRefreshServers = async () => {
    setIsRefreshing(true);
    try {
      await refreshServers();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddServer = () => {
    setEditingServer(null);
    setConfigDialogOpen(true);
  };

  const handleEditServer = (server: any) => {
    setEditingServer(server);
    setConfigDialogOpen(true);
  };

  const handleSaveServer = async (config: MCPClientConfig) => {
    try {
      if (editingServer) {
        // Update existing server
        await updateServer(editingServer.id, config);
      } else {
        // Add new server
        await addServer(config);
      }
      setConfigDialogOpen(false);
      setEditingServer(null);
    } catch (error) {
      throw error;
    }
  };

  const handleTestConnection = async (config: MCPClientConfig) => {
    try {
      // Create a temporary MCP client to test the connection
      const { MCPClient } = await import('@/services/mcp/client');
      const testClient = new MCPClient(config);
      
      // Attempt to connect and initialize
      await testClient.connect();
      
      // Get server capabilities
      const serverInfo = testClient.getServerInfo();
      
      // Clean up test connection
      await testClient.disconnect();
      
      return {
        success: true,
        capabilities: serverInfo.capabilities
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      await toggleServer(serverId, enabled);
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle server connection');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await deleteServer(serverId);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete server');
    }
  };

  const handleReconnectServer = async (serverId: string) => {
    try {
      await reconnectServer(serverId);
    } catch (error) {
      Alert.alert('Error', 'Failed to reconnect to server');
    }
  };

  const connectedCount = servers.filter(s => s.state === MCPConnectionState.CONNECTED).length;
  const errorCount = servers.filter(s => s.state === MCPConnectionState.ERROR).length;

  return (
    <OnboardingScreenLayout>
      <PageHeader 
        title="MCP Servers"
        subtitle="Model Context Protocol server management"
        includeBackButton 
      />
      
      <ScrollView width="95%" showsVerticalScrollIndicator={false}>
        <YStack paddingVertical="$4" paddingHorizontal="$2" gap="$4">
          {/* Status Overview */}
          <MCPConnectionIndicator
            serverCount={servers.length}
            connectedCount={connectedCount}
            errorCount={errorCount}
            isRAGActive={connectedCount > 0}
          />

          {/* Action Buttons */}
          <YStack gap="$3">
            <Button
              backgroundColor="black"
              borderRadius="$4"
              onPress={handleAddServer}
              icon={<Plus size={16} color="white" />}
            >
              <RegularText color="white" fontWeight="500">
                Add MCP Server
              </RegularText>
            </Button>

            <Button
              backgroundColor="$gray2"
              borderColor="$gray6"
              borderWidth={1}
              borderRadius="$4"
              onPress={handleRefreshServers}
              disabled={isRefreshing}
              opacity={isRefreshing ? 0.6 : 1}
              icon={<RefreshCw size={16} />}
            >
              <RegularText>
                {isRefreshing ? 'Refreshing...' : 'Refresh All'}
              </RegularText>
            </Button>
          </YStack>

          {/* Server List */}
          <YStack gap="$3">
            {servers.length === 0 ? (
              <YStack alignItems="center" padding="$6" gap="$3">
                <Server size={32} color="$gray8" />
                <RegularText color="$gray8" textAlign="center">
                  No MCP servers configured
                </RegularText>
                <RegularText fontSize="$3" color="$gray10" textAlign="center">
                  Add your first server to enable enhanced AI capabilities with document retrieval and analysis
                </RegularText>
              </YStack>
            ) : (
              servers.map(server => (
                <MCPServerCard
                  key={server.id}
                  serverId={server.id}
                  serverName={server.config.name || 'Unnamed Server'}
                  serverUrl={(server.config.config as any)?.baseUrl || (server.config.config as any)?.url || ''}
                  state={server.state}
                  enabled={server.enabled}
                  connectionTime={server.connectionTime}
                  resourceCount={server.resourceCount}
                  toolCount={server.toolCount}
                  lastError={server.lastError}
                  onToggleEnabled={(enabled) => handleToggleServer(server.id, enabled)}
                  onConfigure={() => handleEditServer(server)}
                  onDelete={() => handleDeleteServer(server.id)}
                  onReconnect={() => handleReconnectServer(server.id)}
                />
              ))
            )}
          </YStack>

          {/* Help Text */}
          <YStack
            backgroundColor="$blue1"
            borderColor="$blue6"
            borderWidth={1}
            borderRadius="$4"
            padding="$3"
            gap="$2"
          >
            <RegularText fontSize="$4" fontWeight="500" color="$blue10">
              About MCP Servers
            </RegularText>
            <RegularText fontSize="$3" color="$blue9" lineHeight={18}>
              MCP (Model Context Protocol) servers provide AI models with access to external resources, tools, and data sources. Connected servers enable advanced capabilities like document retrieval, code analysis, and real-time data access.
            </RegularText>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Configuration Dialog */}
      <MCPServerConfigDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveServer}
        onTest={handleTestConnection}
        initialConfig={editingServer?.config}
        isEditing={!!editingServer}
      />
    </OnboardingScreenLayout>
  );
}