import React, { useState, useEffect } from 'react';
import { XStack, Text, View } from 'tamagui';
import { Wifi, WifiOff, AlertCircle } from '@tamagui/lucide-icons';
import { mcpClient } from '@/services/mcp/client';
import { MCPServer } from '@/services/mcp/types';

export function MCPStatusIndicator() {
  const [connectedCount, setConnectedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  
  useEffect(() => {
    const updateStatus = () => {
      const servers = mcpClient.getAllServers();
      const connected = servers.filter(s => s.enabled && s.status === 'connected').length;
      const errors = servers.filter(s => s.enabled && s.status === 'error').length;
      setConnectedCount(connected);
      setErrorCount(errors);
    };
    
    // Update initially
    updateStatus();
    
    // Set up listener for status changes
    mcpClient.setStatusChangeHandler(() => {
      updateStatus();
    });
    
    // Check status periodically
    const interval = setInterval(updateStatus, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // Don't show anything if no servers are configured
  if (connectedCount === 0 && errorCount === 0) {
    return null;
  }
  
  return (
    <XStack alignItems="center" gap="$1">
      {connectedCount > 0 && (
        <XStack alignItems="center" gap="$1">
          <Wifi size={14} color="$green10" />
          <Text fontSize="$2" color="$green10">{connectedCount}</Text>
        </XStack>
      )}
      {errorCount > 0 && (
        <XStack alignItems="center" gap="$1">
          <AlertCircle size={14} color="$red10" />
          <Text fontSize="$2" color="$red10">{errorCount}</Text>
        </XStack>
      )}
    </XStack>
  );
}