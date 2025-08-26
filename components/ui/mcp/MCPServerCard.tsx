import { useState } from 'react';
import { XStack, YStack, Button, Text, Progress, Switch } from 'tamagui';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  Settings, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Trash2
} from '@tamagui/lucide-icons';
import { Alert } from 'react-native';
import { RegularText } from '../RegularText';
import { MCPConnectionState } from '@/services/mcp/types';

interface MCPServerCardProps {
  serverId: string;
  serverName: string;
  serverUrl: string;
  state: MCPConnectionState;
  enabled: boolean;
  connectionTime?: number;
  resourceCount?: number;
  toolCount?: number;
  lastError?: string;
  onToggleEnabled: (enabled: boolean) => void;
  onConfigure: () => void;
  onDelete: () => void;
  onReconnect: () => void;
}

export function MCPServerCard({
  serverId,
  serverName,
  serverUrl,
  state,
  enabled,
  connectionTime,
  resourceCount = 0,
  toolCount = 0,
  lastError,
  onToggleEnabled,
  onConfigure,
  onDelete,
  onReconnect
}: MCPServerCardProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const getConnectionIcon = () => {
    switch (state) {
      case MCPConnectionState.CONNECTED:
        return <CheckCircle size={16} color="$green10" />;
      case MCPConnectionState.CONNECTING:
        return <Clock size={16} color="$orange10" />;
      case MCPConnectionState.DISCONNECTED:
        return <WifiOff size={16} color="$gray8" />;
      case MCPConnectionState.ERROR:
        return <AlertTriangle size={16} color="$red10" />;
      default:
        return <WifiOff size={16} color="$gray8" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case MCPConnectionState.CONNECTED:
        return connectionTime 
          ? `Connected (${Math.round(connectionTime)}ms)`
          : 'Connected';
      case MCPConnectionState.CONNECTING:
        return 'Connecting...';
      case MCPConnectionState.DISCONNECTED:
        return enabled ? 'Disconnected' : 'Disabled';
      case MCPConnectionState.ERROR:
        return lastError || 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case MCPConnectionState.CONNECTED:
        return '$green10';
      case MCPConnectionState.CONNECTING:
        return '$orange10';
      case MCPConnectionState.DISCONNECTED:
        return enabled ? '$gray8' : '$gray6';
      case MCPConnectionState.ERROR:
        return '$red10';
      default:
        return '$gray8';
    }
  };

  const handleReconnect = async () => {
    setIsConnecting(true);
    try {
      await onReconnect();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete MCP Server',
      `Are you sure you want to delete "${serverName}"? This will remove all server configuration and cached data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: onDelete 
        }
      ]
    );
  };

  return (
    <YStack
      backgroundColor="$gray1"
      borderColor="$gray6"
      borderWidth={1}
      borderRadius="$6"
      padding="$4"
      gap="$3"
    >
      {/* Header with server info and toggle */}
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$3" flex={1}>
          <Server size={20} color="$gray10" />
          <YStack flex={1}>
            <RegularText fontSize="$5" fontWeight="600">
              {serverName}
            </RegularText>
            <RegularText fontSize="$3" color="$gray10" numberOfLines={1}>
              {serverUrl}
            </RegularText>
          </YStack>
        </XStack>
        
        <Switch
          size="$3"
          checked={enabled}
          backgroundColor={enabled ? "black" : "$gray6"}
          onCheckedChange={onToggleEnabled}
          borderColor="transparent"
        >
          <Switch.Thumb 
            size="$3" 
            backgroundColor="white" 
            borderColor="black" 
            borderWidth="$0.5"
          />
        </Switch>
      </XStack>

      {/* Connection Status */}
      <XStack alignItems="center" gap="$2">
        {getConnectionIcon()}
        <RegularText 
          fontSize="$3" 
          color={getStatusColor()}
          flex={1}
        >
          {getStatusText()}
        </RegularText>
        
        {state === MCPConnectionState.CONNECTING && (
          <Progress value={50} max={100} width={60} height={4}>
            <Progress.Indicator 
              animation="bouncy" 
              backgroundColor="$orange10" 
            />
          </Progress>
        )}
      </XStack>

      {/* Capabilities Summary */}
      {enabled && state === MCPConnectionState.CONNECTED && (
        <XStack alignItems="center" gap="$4">
          <XStack alignItems="center" gap="$1">
            <Text fontSize="$3" color="$gray10">📄</Text>
            <RegularText fontSize="$3" color="$gray10">
              {resourceCount} resources
            </RegularText>
          </XStack>
          
          <XStack alignItems="center" gap="$1">
            <Text fontSize="$3" color="$gray10">🔧</Text>
            <RegularText fontSize="$3" color="$gray10">
              {toolCount} tools
            </RegularText>
          </XStack>
        </XStack>
      )}

      {/* Error Details */}
      {state === MCPConnectionState.ERROR && lastError && (
        <YStack
          backgroundColor="$red1"
          borderColor="$red6"
          borderWidth={1}
          borderRadius="$4"
          padding="$2"
        >
          <RegularText fontSize="$3" color="$red10">
            {lastError}
          </RegularText>
        </YStack>
      )}

      {/* Action Buttons */}
      <XStack gap="$2" marginTop="$1">
        {(state === MCPConnectionState.DISCONNECTED || state === MCPConnectionState.ERROR) && enabled && (
          <Button
            size="$3"
            backgroundColor="$gray2"
            borderColor="$gray6"
            borderWidth={1}
            borderRadius="$4"
            flex={1}
            onPress={handleReconnect}
            disabled={isConnecting}
            opacity={isConnecting ? 0.6 : 1}
            icon={<Wifi size={14} />}
          >
            <RegularText fontSize="$3">
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </RegularText>
          </Button>
        )}
        
        <Button
          size="$3"
          backgroundColor="$gray2"
          borderColor="$gray6"
          borderWidth={1}
          borderRadius="$4"
          flex={1}
          onPress={onConfigure}
          icon={<Settings size={14} />}
        >
          <RegularText fontSize="$3">Configure</RegularText>
        </Button>
        
        <Button
          size="$3"
          backgroundColor="$red1"
          borderColor="$red6"
          borderWidth={1}
          borderRadius="$4"
          onPress={handleDelete}
          icon={<Trash2 size={14} color="$red10" />}
        >
          <RegularText fontSize="$3" color="$red10">Delete</RegularText>
        </Button>
      </XStack>
    </YStack>
  );
}