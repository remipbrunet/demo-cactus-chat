import { Button, Input, Text, XStack, YStack, Spinner } from 'tamagui'
import { useState } from 'react'
import { Modal, View, TouchableWithoutFeedback } from 'react-native'
import OpenAI from 'openai'
import { Anthropic } from '@anthropic-ai/sdk'

interface ApiKeyDialogProps {
  open: boolean
  provider: 'OpenAI' | 'Anthropic'
  onClose: () => void
  onSave: (key: string) => void
}

export function ApiKeyDialog({ open, provider, onClose, onSave }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  
  const validateOpenAIKey = async (key: string): Promise<boolean> => {
    try {
      setIsValidating(true)
      setErrorMessage('')
      
      const openai = new OpenAI({
        apiKey: key,
        dangerouslyAllowBrowser: true,
      })
      
      // Make a simple models list request to validate the key
      await openai.models.list()
      return true
    } catch (error) {
      console.error('OpenAI validation error:', error)
      setErrorMessage('Invalid API key. Please check and try again.')
      return false
    } finally {
      setIsValidating(false)
    }
  }
  
  const validateAnthropicKey = async (key: string): Promise<boolean> => {
    try {
      setIsValidating(true)
      setErrorMessage('')
      
      const anthropic = new Anthropic({
        apiKey: key,
      })
      
      // Make a simple models request to validate the key
      await anthropic.models.list()
      return true
    } catch (error) {
      console.error('Anthropic validation error:', error)
      setErrorMessage('Invalid API key. Please check and try again.')
      return false
    } finally {
      setIsValidating(false)
    }
  }
  
  const handleSave = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key')
      return
    }
    
    let isValid = false
    
    if (provider === 'OpenAI') {
      isValid = await validateOpenAIKey(apiKey.trim())
    } else if (provider === 'Anthropic') {
      isValid = await validateAnthropicKey(apiKey.trim())
    }
    
    if (isValid) {
      onSave(apiKey.trim())
      setApiKey('')
      setErrorMessage('')
    }
  }
  
  const closeDialog = () => {
    setApiKey('')
    setErrorMessage('')
    onClose()
  }
  
  if (!open) return null;
  
  return (
    <Modal
      transparent={true}
      visible={open}
      animationType="fade"
      onRequestClose={closeDialog}
    >
      <TouchableWithoutFeedback onPress={closeDialog}>
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <YStack
              backgroundColor="$background"
              borderRadius={10}
              padding={16}
              width={300}
              maxWidth="90%"
            >
              <Text fontSize={18} fontWeight="600" marginBottom={8}>
                Connect to {provider}
              </Text>
              
              <Text fontSize={14} color="$gray11" marginBottom={16}>
                Enter your {provider} API key to connect your account.
              </Text>
              
              <Input
                value={apiKey}
                onChangeText={(text) => {
                  setApiKey(text)
                  if (errorMessage) setErrorMessage('')
                }}
                placeholder={`${provider} API Key`}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                marginVertical={8}
              />
              
              {errorMessage ? (
                <Text color="$red10" fontSize={13} marginTop={4}>
                  {errorMessage}
                </Text>
              ) : null}
              
              <XStack gap={8} justifyContent="flex-end" marginTop={16}>
                <Button 
                  size="$3"
                  onPress={closeDialog}
                  disabled={isValidating}
                >
                  Cancel
                </Button>
                <Button 
                  size="$3"
                  theme="active" 
                  onPress={handleSave}
                  disabled={isValidating}
                  icon={isValidating ? () => <Spinner size="small" /> : undefined}
                >
                  {isValidating ? 'Validating...' : 'Save'}
                </Button>
              </XStack>
            </YStack>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
} 