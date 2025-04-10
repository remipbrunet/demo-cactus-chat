import { XStack, YStack, Text, Button, ScrollView } from 'tamagui';
import { Conversation } from '../services/storage';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from '@tamagui/lucide-icons';

interface ConversationSidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  zIndex?: number;
}

export function ConversationSidebar({ 
  isOpen, 
  conversations, 
  onClose, 
  onSelectConversation,
  onNewConversation,
  zIndex = 100
}: ConversationSidebarProps) {
  // Prevent scrolling of background content when sidebar is open
  useEffect(() => {
    return () => {}; // Cleanup effect
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <XStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={zIndex}
      backgroundColor="rgba(0, 0, 0, 0.4)"
      onPress={onClose}
      animation="quick"
      opacity={isOpen ? 1 : 0}
      pointerEvents={isOpen ? 'auto' : 'none'}
      enterStyle={{
        opacity: 0,
      }}
      exitStyle={{
        opacity: 0,
      }}
    >
      <YStack
        backgroundColor="$background"
        width="82%"
        height="100%"
        borderRightWidth={1}
        borderColor="$borderColor"
        animation="medium"
        x={isOpen ? 0 : -300}
        onPress={(e) => e.stopPropagation()}
        enterStyle={{
          x: -300,
          opacity: 0,
        }}
        exitStyle={{
          x: -300,
          opacity: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <YStack flex={1} padding={16}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={16}>
              <Text fontSize={18} fontWeight="600">Conversations</Text>
              <Button
                icon={Plus}
                size="$2"
                circular
                onPress={() => {
                  onNewConversation();
                  onClose();
                }}
              />
            </XStack>
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              {conversations.length === 0 ? (
                <Text color="$gray10" marginTop={8}>No conversations yet</Text>
              ) : (
                conversations.map((conversation) => (
                  <Button
                    key={conversation.id}
                    onPress={() => {
                      onSelectConversation(conversation.id);
                      onClose();
                    }}
                    marginVertical={6}
                    backgroundColor="transparent"
                    justifyContent="flex-start"
                    hoverStyle={{ backgroundColor: '$gray3' }}
                    pressStyle={{ backgroundColor: '$gray4' }}
                    borderRadius="$4"
                    paddingVertical={10}
                    paddingHorizontal={12}
                  >
                    <YStack>
                      <Text fontSize={15} fontWeight="500" numberOfLines={1}>{conversation.title}</Text>
                      <Text fontSize={13} color="$gray11" marginTop={2} numberOfLines={1}>
                        {new Date(conversation.lastUpdated).toLocaleDateString()} · {conversation.model?.label}
                      </Text>
                    </YStack>
                  </Button>
                ))
              )}
            </ScrollView>
          </YStack>
        </SafeAreaView>
      </YStack>
    </XStack>
  );
} 