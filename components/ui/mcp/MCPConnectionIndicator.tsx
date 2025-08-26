import { XStack, YStack, Text } from 'tamagui';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  WifiOff,
  Zap
} from '@tamagui/lucide-icons';
import { RegularText } from '../RegularText';
import { MCPConnectionState } from '@/services/mcp/types';

interface MCPConnectionIndicatorProps {
  serverCount: number;
  connectedCount: number;
  errorCount: number;
  isRAGActive: boolean;
  compact?: boolean;
}

export function MCPConnectionIndicator({
  serverCount,
  connectedCount,
  errorCount,
  isRAGActive,
  compact = false
}: MCPConnectionIndicatorProps) {
  const getOverallStatus = () => {
    if (serverCount === 0) return 'no-servers';
    if (errorCount > 0) return 'error';
    if (connectedCount === 0) return 'disconnected';
    if (connectedCount < serverCount) return 'partial';
    return 'connected';
  };

  const getStatusIcon = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'connected':
        return <CheckCircle size={compact ? 16 : 20} color="$green10" />;
      case 'partial':
        return <Clock size={compact ? 16 : 20} color="$orange10" />;
      case 'error':
        return <AlertTriangle size={compact ? 16 : 20} color="$red10" />;
      case 'disconnected':
      case 'no-servers':
        return <WifiOff size={compact ? 16 : 20} color="$gray8" />;
      default:
        return <WifiOff size={compact ? 16 : 20} color="$gray8" />;
    }
  };

  const getStatusText = () => {
    const status = getOverallStatus();
    if (serverCount === 0) return 'No MCP servers';
    
    switch (status) {
      case 'connected':
        return `${connectedCount}/${serverCount} servers connected`;
      case 'partial':
        return `${connectedCount}/${serverCount} servers connected`;
      case 'error':
        return `${errorCount} server${errorCount > 1 ? 's' : ''} with errors`;
      case 'disconnected':
        return 'All servers disconnected';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'connected':
        return '$green10';
      case 'partial':
        return '$orange10';
      case 'error':
        return '$red10';
      case 'disconnected':
      case 'no-servers':
        return '$gray8';
      default:
        return '$gray8';
    }
  };

  if (compact) {
    return (
      <XStack alignItems="center" gap="$2">
        {getStatusIcon()}
        {isRAGActive && (
          <>
            <Zap size={14} color="$blue10" />
            <Text fontSize="$2" color="$blue10">RAG</Text>
          </>
        )}
      </XStack>
    );
  }

  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor="$gray1"
      borderColor="$gray6"
      borderWidth={1}
      borderRadius="$4"
      paddingHorizontal="$3"
      paddingVertical="$2"
    >
      {getStatusIcon()}
      
      <YStack flex={1}>
        <RegularText 
          fontSize="$4" 
          fontWeight="500"
          color={getStatusColor()}
        >
          MCP Status
        </RegularText>
        <RegularText 
          fontSize="$3" 
          color="$gray10"
        >
          {getStatusText()}
        </RegularText>
      </YStack>

      {isRAGActive && (
        <XStack alignItems="center" gap="$1">
          <Zap size={16} color="$blue10" />
          <RegularText fontSize="$3" color="$blue10" fontWeight="500">
            RAG Active
          </RegularText>
        </XStack>
      )}
    </XStack>
  );
}