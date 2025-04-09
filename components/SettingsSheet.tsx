import { YStack, Button, Text, XStack } from 'tamagui'
import { Modal, View, TouchableWithoutFeedback, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { Check, Trash } from '@tamagui/lucide-icons'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnectOpenAI: () => void
  onConnectAnthropic: () => void
  onDeleteOpenAI?: () => void
  onDeleteAnthropic?: () => void
  hasOpenAIKey: boolean
  hasAnthropicKey: boolean
}

export function SettingsSheet({ 
  open, 
  onOpenChange,
  onConnectOpenAI,
  onConnectAnthropic,
  onDeleteOpenAI,
  onDeleteAnthropic,
  hasOpenAIKey,
  hasAnthropicKey
}: SettingsSheetProps) {
  // Fade-in animation for overlay
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Slide-up animation for the sheet
  const slideAnim = useRef(new Animated.Value(300)).current;
  
  useEffect(() => {
    if (open) {
      // Animate the fade and slide when opening
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Reset animations when closed
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [open, fadeAnim, slideAnim]);
  
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <Animated.View 
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: fadeAnim,
        }}
      >
        <TouchableWithoutFeedback onPress={() => onOpenChange(false)}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
        
        <Animated.View
          style={{
            height: '75%',
            transform: [{ translateY: slideAnim }],
          }}
        >
          <YStack
            backgroundColor="$background"
            borderTopLeftRadius={15}
            borderTopRightRadius={15}
            padding={16}
            height="100%"
          >
            {/* Handle indicator */}
            <XStack justifyContent="center" marginBottom={20}>
              <View style={{
                width: 40,
                height: 5,
                backgroundColor: '#ccc',
                borderRadius: 3,
              }} />
            </XStack>
            
            <Text fontSize={18} fontWeight="600" textAlign="center" marginBottom={16}>
              Settings
            </Text>
            
            <XStack alignItems="center" marginBottom={8}>
              <Button 
                flex={1}
                size="$4" 
                marginTop={8}
                marginBottom={16}
                disabled={hasOpenAIKey}
                opacity={hasOpenAIKey ? 0.6 : 1}
                onPress={() => {
                  onConnectOpenAI();
                }}
                icon={hasOpenAIKey ? Check : undefined}
              >
                {hasOpenAIKey ? 'Connected to OpenAI' : 'Connect OpenAI'}
              </Button>
              
              {hasOpenAIKey && onDeleteOpenAI && (
                <Button
                  marginLeft={8}
                  marginTop={8}
                  marginBottom={16}
                  size="$4"
                  theme="red"
                  icon={Trash}
                  circular
                  onPress={onDeleteOpenAI}
                />
              )}
            </XStack>
            
            <XStack alignItems="center" marginBottom={8}>
              <Button 
                flex={1}
                size="$4" 
                marginTop={8}
                disabled={hasAnthropicKey}
                opacity={hasAnthropicKey ? 0.6 : 1}
                onPress={() => {
                  onConnectAnthropic();
                }}
                icon={hasAnthropicKey ? Check : undefined}
              >
                {hasAnthropicKey ? 'Connected to Anthropic' : 'Connect Anthropic'}
              </Button>
              
              {hasAnthropicKey && onDeleteAnthropic && (
                <Button
                  marginLeft={8}
                  marginTop={8}
                  size="$4"
                  theme="red"
                  icon={Trash}
                  circular
                  onPress={onDeleteAnthropic}
                />
              )}
            </XStack>
          </YStack>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
} 