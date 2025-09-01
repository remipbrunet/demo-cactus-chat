import React, { useState, useEffect } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Input,
  Switch,
  View,
  Dialog,
} from 'tamagui';
import {
  Server,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  AlertCircle,
  WifiOff,
  Wifi,
  Loader,
} from '@tamagui/lucide-icons';
import { Alert, Modal } from 'react-native';
import { MCPServer } from '@/services/mcp/types';
import { MCPStorage } from '@/services/mcp/storage';
import { mcpClient } from '@/services/mcp/client';
import { RegularText } from '@/components/ui/RegularText';

interface TextWithIconProps {
  Icon: React.ElementType;
  text: string;
}

function TextWithIcon({ Icon, text }: TextWithIconProps) {
  return (
    <XStack flex={1} alignItems="center" gap="$2">
      <Icon size={16} />
      <Text fontSize="$4" fontWeight="400" textAlign="left">
        {text}
      </Text>
    </XStack>
  );
}

function ServerStatusIcon({ status }: { status: MCPServer['status'] }) {
  switch (status) {
    case 'connected':
      return <Wifi size={16} color="$green10" />;
    case 'connecting':
      return <Loader size={16} color="$blue10" />;
    case 'error':
      return <AlertCircle size={16} color="$red10" />;
    default:
      return <WifiOff size={16} color="$gray10" />;
  }
}

export function MCPServerSettings() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    description: '',
    apiKey: '',
  });
  const [testing, setTesting] = useState<string | null>(null);
  const [unreachableCount, setUnreachableCount] = useState(0);

  useEffect(() => {
    loadServers();
    
    // Set up status change handler
    mcpClient.setStatusChangeHandler((serverId, status) => {
      setServers(prev => prev.map(s => 
        s.id === serverId ? { ...s, status } : s
      ));
      updateUnreachableCount();
    });

    // Connect to enabled servers on mount
    connectEnabledServers();
  }, []);

  const loadServers = async () => {
    const loaded = await MCPStorage.loadServers();
    setServers(loaded);
    updateUnreachableCount();
  };

  const connectEnabledServers = async () => {
    const loaded = await MCPStorage.loadServers();
    for (const server of loaded.filter(s => s.enabled)) {
      try {
        await mcpClient.connectToServer(server);
      } catch (error) {
        console.error(`Failed to connect to ${server.name}:`, error);
      }
    }
  };

  const updateUnreachableCount = () => {
    const count = servers.filter(s => s.enabled && s.status === 'error').length;
    setUnreachableCount(count);
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) {
      Alert.alert('Error', 'Name and URL are required');
      return;
    }

    try {
      const server = await MCPStorage.addServer({
        name: newServer.name,
        url: newServer.url,
        description: newServer.description,
        apiKey: newServer.apiKey,
        enabled: true,
      });

      setServers([...servers, server]);
      setShowAddDialog(false);
      setNewServer({ name: '', url: '', description: '', apiKey: '' });

      // Try to connect immediately
      await testConnection(server);
    } catch (error) {
      Alert.alert('Error', 'Failed to add server');
    }
  };

  const handleUpdateServer = async () => {
    if (!editingServer) return;

    try {
      await MCPStorage.updateServer(editingServer.id, editingServer);
      setServers(servers.map(s => 
        s.id === editingServer.id ? editingServer : s
      ));
      setEditingServer(null);
      
      // Reconnect if enabled
      if (editingServer.enabled) {
        mcpClient.disconnectServer(editingServer.id);
        await testConnection(editingServer);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update server');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    Alert.alert(
      'Delete Server',
      'Are you sure you want to delete this server?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            mcpClient.disconnectServer(serverId);
            await MCPStorage.deleteServer(serverId);
            setServers(servers.filter(s => s.id !== serverId));
          },
        },
      ]
    );
  };

  const toggleServerEnabled = async (server: MCPServer) => {
    const updated = { ...server, enabled: !server.enabled };
    await MCPStorage.updateServer(server.id, updated);
    setServers(servers.map(s => s.id === server.id ? updated : s));

    if (updated.enabled) {
      await testConnection(updated);
    } else {
      mcpClient.disconnectServer(server.id);
    }
  };

  const testConnection = async (server: MCPServer) => {
    setTesting(server.id);
    try {
      await mcpClient.connectToServer(server);
      const connectedServer = mcpClient.getServer(server.id);
      if (connectedServer) {
        setServers(prev => prev.map(s => 
          s.id === server.id ? connectedServer : s
        ));
        Alert.alert(
          'Success',
          `Connected to ${server.name}. Found ${connectedServer.tools?.length || 0} tools.`
        );
      }
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        `Could not connect to ${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setTesting(null);
    }
  };

  return (
    <YStack gap="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <TextWithIcon Icon={Server} text="MCP Servers" />
        <Button
          size="$2"
          icon={Plus}
          onPress={() => setShowAddDialog(true)}
          circular
        />
      </XStack>

      {unreachableCount > 0 && (
        <XStack
          backgroundColor="$red2"
          padding="$2"
          borderRadius="$2"
          alignItems="center"
          gap="$2"
        >
          <AlertCircle size={16} color="$red10" />
          <RegularText color="$red10">
            {unreachableCount} MCP server{unreachableCount > 1 ? 's are' : ' is'} unreachable
          </RegularText>
        </XStack>
      )}

      <YStack gap="$2">
        {servers.map(server => (
          <XStack
            key={server.id}
            backgroundColor="$gray2"
            padding="$3"
            borderRadius="$2"
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack flex={1} alignItems="center" gap="$2">
              <ServerStatusIcon status={server.status} />
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="500">
                  {server.name}
                </Text>
                {server.description && (
                  <Text fontSize="$2" color="$gray10">
                    {server.description}
                  </Text>
                )}
                {server.tools && server.tools.length > 0 && (
                  <Text fontSize="$2" color="$green10">
                    {server.tools.length} tool{server.tools.length > 1 ? 's' : ''} available
                  </Text>
                )}
              </YStack>
            </XStack>

            <XStack gap="$2" alignItems="center">
              <Switch
                size="$2"
                checked={server.enabled}
                onCheckedChange={() => toggleServerEnabled(server)}
              />
              <Button
                size="$2"
                icon={Edit3}
                onPress={() => setEditingServer(server)}
                circular
                chromeless
              />
              <Button
                size="$2"
                icon={Trash2}
                onPress={() => handleDeleteServer(server.id)}
                circular
                chromeless
                color="$red10"
              />
            </XStack>
          </XStack>
        ))}

        {servers.length === 0 && (
          <YStack padding="$4" alignItems="center">
            <RegularText>No MCP servers configured</RegularText>
            <RegularText fontSize="$2" color="$gray10">
              Add a server to enable tool calling
            </RegularText>
          </YStack>
        )}
      </YStack>

      <Button
        size="$3"
        onPress={() => {
          servers.filter(s => s.enabled).forEach(s => testConnection(s));
        }}
        disabled={testing !== null}
      >
        {testing ? 'Testing...' : 'Test All Connections'}
      </Button>

      {/* Add Server Dialog */}
      <Modal
        visible={showAddDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddDialog(false)}
      >
        <View flex={1} backgroundColor="rgba(0,0,0,0.5)" justifyContent="center" alignItems="center">
          <View backgroundColor="$background" padding="$4" borderRadius="$4" width="90%" maxWidth={400}>
            <YStack gap="$4">
              <Text fontSize="$5" fontWeight="600">
                Add MCP Server
              </Text>

              <Input
                placeholder="Server Name"
                value={newServer.name}
                onChangeText={text => setNewServer({ ...newServer, name: text })}
              />

              <Input
                placeholder="Server URL (e.g., http://192.168.1.100:3000/sse)"
                value={newServer.url}
                onChangeText={text => setNewServer({ ...newServer, url: text })}
                autoCapitalize="none"
              />

              <Input
                placeholder="Description (optional)"
                value={newServer.description}
                onChangeText={text => setNewServer({ ...newServer, description: text })}
              />

              <Input
                placeholder="API Key (optional)"
                value={newServer.apiKey}
                onChangeText={text => setNewServer({ ...newServer, apiKey: text })}
                secureTextEntry
              />

              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$3"
                  onPress={() => {
                    setShowAddDialog(false);
                    setNewServer({ name: '', url: '', description: '', apiKey: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  theme="green"
                  onPress={handleAddServer}
                >
                  Add Server
                </Button>
              </XStack>
            </YStack>
          </View>
        </View>
      </Modal>

      {/* Edit Server Dialog */}
      <Modal
        visible={!!editingServer}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingServer(null)}
      >
        <View flex={1} backgroundColor="rgba(0,0,0,0.5)" justifyContent="center" alignItems="center">
          <View backgroundColor="$background" padding="$4" borderRadius="$4" width="90%" maxWidth={400}>
            <YStack gap="$4">
              <Text fontSize="$5" fontWeight="600">
                Edit MCP Server
              </Text>

              <Input
                placeholder="Server Name"
                value={editingServer?.name || ''}
                onChangeText={text => setEditingServer(prev => prev ? { ...prev, name: text } : null)}
              />

              <Input
                placeholder="Server URL"
                value={editingServer?.url || ''}
                onChangeText={text => setEditingServer(prev => prev ? { ...prev, url: text } : null)}
                autoCapitalize="none"
              />

              <Input
                placeholder="Description (optional)"
                value={editingServer?.description || ''}
                onChangeText={text => setEditingServer(prev => prev ? { ...prev, description: text } : null)}
              />

              <Input
                placeholder="API Key (optional)"
                value={editingServer?.apiKey || ''}
                onChangeText={text => setEditingServer(prev => prev ? { ...prev, apiKey: text } : null)}
                secureTextEntry
              />

              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$3"
                  onPress={() => setEditingServer(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  theme="green"
                  onPress={handleUpdateServer}
                >
                  Save Changes
                </Button>
              </XStack>
            </YStack>
          </View>
        </View>
      </Modal>
    </YStack>
  );
}