import { useState, useEffect } from 'react';
import { 
  Dialog,
  XStack,
  YStack,
  Button,
  Input,
  Text,
  ToggleGroup,
  Switch,
  ScrollView
} from 'tamagui';
import { 
  X,
  Check,
  Server,
  Globe,
  Key,
  Settings,
  TestTube
} from '@tamagui/lucide-icons';
import { Alert } from 'react-native';
import { RegularText } from '../RegularText';
import { MCPClientConfig, MCPConnectionState } from '@/services/mcp/types';

interface MCPServerConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: MCPClientConfig) => Promise<void>;
  onTest?: (config: MCPClientConfig) => Promise<{ success: boolean; error?: string; capabilities?: any }>;
  initialConfig?: Partial<MCPClientConfig>;
  isEditing?: boolean;
}

export function MCPServerConfigDialog({
  open,
  onClose,
  onSave,
  onTest,
  initialConfig,
  isEditing = false
}: MCPServerConfigDialogProps) {
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transport, setTransport] = useState<'http' | 'websocket'>('http');
  const [apiKey, setApiKey] = useState('');
  const [enableLogging, setEnableLogging] = useState(false);
  const [timeout, setTimeoutValue] = useState(30000);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    capabilities?: any;
  } | null>(null);

  // Initialize form with existing config
  useEffect(() => {
    if (initialConfig) {
      setServerName(initialConfig.name || '');
      setServerUrl((initialConfig.config as any)?.baseUrl || (initialConfig.config as any)?.url || '');
      setTransport(initialConfig.transport || 'http');
      setApiKey((initialConfig.config as any)?.apiKey || '');
      setEnableLogging(initialConfig.debug || false);
      setTimeoutValue(initialConfig.config?.timeout || 30000);
    } else {
      // Reset form for new server
      setServerName('');
      setServerUrl('');
      setTransport('http');
      setApiKey('');
      setEnableLogging(false);
      setTimeoutValue(30000);
    }
    setTestResult(null);
  }, [initialConfig, open]);

  const buildConfig = (): MCPClientConfig => {
    if (transport === 'http') {
      return {
        name: serverName,
        version: '1.0.0',
        transport,
        debug: enableLogging,
        config: {
          baseUrl: serverUrl,
          timeout,
          ...(apiKey && { apiKey })
        }
      };
    } else {
      return {
        name: serverName,
        version: '1.0.0',
        transport,
        debug: enableLogging,
        config: {
          url: serverUrl,
          timeout,
          autoReconnect: true
        }
      };
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    
    const config = buildConfig();
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await onTest(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    // Validate form
    if (!serverName.trim()) {
      Alert.alert('Error', 'Please enter a server name');
      return;
    }
    
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(serverUrl);
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    const config = buildConfig();
    
    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      Alert.alert(
        'Save Failed',
        error instanceof Error ? error.message : 'Failed to save server configuration'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving || isTesting) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
          backgroundColor="white"
        >
          <Dialog.Title>
            <XStack alignItems="center" gap="$2">
              <Server size={20} />
              <RegularText fontSize="$6" fontWeight="600">
                {isEditing ? 'Edit MCP Server' : 'Add MCP Server'}
              </RegularText>
            </XStack>
          </Dialog.Title>

          <Dialog.Description>
            <RegularText color="$gray10">
              Configure connection settings for the Model Context Protocol server.
            </RegularText>
          </Dialog.Description>

          <ScrollView maxHeight={400} showsVerticalScrollIndicator={false}>
            <YStack gap="$4" padding="$1">
              {/* Server Name */}
              <YStack gap="$2">
                <RegularText fontSize="$4" fontWeight="500">
                  Server Name
                </RegularText>
                <Input
                  placeholder="My MCP Server"
                  value={serverName}
                  onChangeText={setServerName}
                  backgroundColor="$gray1"
                  borderColor="$gray6"
                  borderRadius="$4"
                />
              </YStack>

              {/* Transport Type */}
              <YStack gap="$2">
                <RegularText fontSize="$4" fontWeight="500">
                  Transport Protocol
                </RegularText>
                <ToggleGroup 
                  type="single" 
                  value={transport} 
                  onValueChange={(value: string) => setTransport(value as 'http' | 'websocket')}
                >
                  <ToggleGroup.Item 
                    value="http" 
                    flex={1} 
                    borderColor={transport === 'http' ? "black" : "$gray6"}
                  >
                    <RegularText>HTTP</RegularText>
                  </ToggleGroup.Item>
                  <ToggleGroup.Item 
                    value="websocket" 
                    flex={1} 
                    borderColor={transport === 'websocket' ? "black" : "$gray6"}
                  >
                    <RegularText>WebSocket</RegularText>
                  </ToggleGroup.Item>
                </ToggleGroup>
                <RegularText fontSize="$3" color="$gray10">
                  HTTP is recommended for most servers. Use WebSocket for real-time features.
                </RegularText>
              </YStack>

              {/* Server URL */}
              <YStack gap="$2">
                <XStack alignItems="center" gap="$2">
                  <Globe size={16} />
                  <RegularText fontSize="$4" fontWeight="500">
                    Server URL
                  </RegularText>
                </XStack>
                <Input
                  placeholder={transport === 'http' 
                    ? 'https://api.example.com/mcp' 
                    : 'wss://api.example.com/mcp'
                  }
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  backgroundColor="$gray1"
                  borderColor="$gray6"
                  borderRadius="$4"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </YStack>

              {/* API Key */}
              <YStack gap="$2">
                <XStack alignItems="center" gap="$2">
                  <Key size={16} />
                  <RegularText fontSize="$4" fontWeight="500">
                    API Key (Optional)
                  </RegularText>
                </XStack>
                <Input
                  placeholder="Enter API key if required"
                  value={apiKey}
                  onChangeText={setApiKey}
                  backgroundColor="$gray1"
                  borderColor="$gray6"
                  borderRadius="$4"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </YStack>

              {/* Advanced Settings */}
              <YStack gap="$3">
                <XStack alignItems="center" gap="$2">
                  <Settings size={16} />
                  <RegularText fontSize="$4" fontWeight="500">
                    Advanced Settings
                  </RegularText>
                </XStack>

                {/* Timeout */}
                <XStack alignItems="center" gap="$3">
                  <RegularText fontSize="$3" flex={1}>
                    Connection Timeout
                  </RegularText>
                  <Input
                    width={80}
                    value={String(timeout)}
                    onChangeText={(text) => {
                      const num = parseInt(text);
                      if (!isNaN(num)) {
                        setTimeoutValue(Math.max(1000, Math.min(120000, num)));
                      }
                    }}
                    backgroundColor="$gray1"
                    borderColor="$gray6"
                    borderRadius="$3"
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <RegularText fontSize="$3" color="$gray10">
                    ms
                  </RegularText>
                </XStack>

                {/* Debug Logging */}
                <XStack alignItems="center" justifyContent="space-between">
                  <RegularText fontSize="$3">
                    Enable Debug Logging
                  </RegularText>
                  <Switch
                    size="$3"
                    checked={enableLogging}
                    backgroundColor={enableLogging ? "black" : "$gray6"}
                    onCheckedChange={setEnableLogging}
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
              </YStack>

              {/* Test Results */}
              {testResult && (
                <YStack
                  backgroundColor={testResult.success ? "$green1" : "$red1"}
                  borderColor={testResult.success ? "$green6" : "$red6"}
                  borderWidth={1}
                  borderRadius="$4"
                  padding="$3"
                  gap="$2"
                >
                  <XStack alignItems="center" gap="$2">
                    {testResult.success ? (
                      <Check size={16} color="$green10" />
                    ) : (
                      <X size={16} color="$red10" />
                    )}
                    <RegularText 
                      fontSize="$4" 
                      fontWeight="500"
                      color={testResult.success ? "$green10" : "$red10"}
                    >
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </RegularText>
                  </XStack>

                  {testResult.error && (
                    <RegularText fontSize="$3" color="$red10">
                      {testResult.error}
                    </RegularText>
                  )}

                  {testResult.success && testResult.capabilities && (
                    <YStack gap="$1">
                      <RegularText fontSize="$3" color="$green10">
                        Server capabilities detected:
                      </RegularText>
                      {testResult.capabilities.resources && (
                        <RegularText fontSize="$3" color="$gray10">
                          • Resources: {testResult.capabilities.resources.subscribe ? 'Yes' : 'No'}
                        </RegularText>
                      )}
                      {testResult.capabilities.tools && (
                        <RegularText fontSize="$3" color="$gray10">
                          • Tools: {testResult.capabilities.tools.subscribe ? 'Yes' : 'No'}
                        </RegularText>
                      )}
                    </YStack>
                  )}
                </YStack>
              )}
            </YStack>
          </ScrollView>

          <XStack gap="$3" justifyContent="flex-end">
            {onTest && (
              <Button
                backgroundColor="$gray2"
                borderColor="$gray6"
                borderWidth={1}
                borderRadius="$4"
                onPress={handleTest}
                disabled={isTesting || isSaving || !serverUrl.trim()}
                opacity={isTesting ? 0.6 : 1}
                icon={<TestTube size={16} />}
              >
                <RegularText>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </RegularText>
              </Button>
            )}

            <Button
              backgroundColor="$gray2"
              borderColor="$gray6"
              borderWidth={1}
              borderRadius="$4"
              onPress={handleClose}
              disabled={isSaving || isTesting}
            >
              <RegularText>Cancel</RegularText>
            </Button>

            <Button
              backgroundColor="black"
              borderRadius="$4"
              onPress={handleSave}
              disabled={isSaving || isTesting || !serverName.trim() || !serverUrl.trim()}
              opacity={isSaving ? 0.6 : 1}
              icon={<Check size={16} color="white" />}
            >
              <RegularText color="white">
                {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Add Server'}
              </RegularText>
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}