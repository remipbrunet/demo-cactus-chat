import { Button, Input, Text, XStack, YStack, Spinner } from 'tamagui'
import { useState } from 'react'
import { Modal, View, TouchableWithoutFeedback } from 'react-native'
import OpenAI from 'openai'
import { Anthropic } from '@anthropic-ai/sdk'
import {GoogleGenAI} from '@google/genai';
import { useModelContext } from '@/contexts/modelContext';
import { saveApiKey } from '@/services/storage';
import { Provider } from '@/services/models';

interface ApiKeyDialogProps {
  open: boolean
  provider: Provider
  onClose: () => void
}

export function ApiKeyDialog({ open, provider, onClose }: ApiKeyDialogProps) {

  const { refreshModels } = useModelContext();
  const [apiKey, setApiKey] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  interface ValidationParams {
    key: string
    provider: Provider
  }

  const validateKey = async (params: ValidationParams): Promise<boolean> => {
    try { 
      setIsValidating(true)
      setErrorMessage('')
      
      switch (params.provider) {
        case 'OpenAI': {
          const openai = new OpenAI({
            apiKey: params.key,
            dangerouslyAllowBrowser: true,
          })
          await openai.models.list()
          return true
        }
        case 'Anthropic': {
          const anthropic = new Anthropic({
            apiKey: params.key,
          })
          await anthropic.models.list()
          return true
        }
        case 'Google': {
          const genAI = new GoogleGenAI({apiKey: params.key});
          await genAI.models.get({model: 'gemini-2.0-flash'})
          return true
        }
        default: {
          return false
        }
      }
    } catch (error) {
      console.error(`Validation error for ${params.provider}:`, error)
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
      isValid = await validateKey({key: apiKey.trim(), provider: 'OpenAI'})
    } else if (provider === 'Anthropic') {
      isValid = await validateKey({key: apiKey.trim(), provider: 'Anthropic'})
    } else if (provider === 'Google') {
      isValid = await validateKey({key: apiKey.trim(), provider: 'Google'})
    }
    
    if (isValid) {
      await saveApiKey(provider, apiKey.trim())
      setApiKey('')
      setErrorMessage('')
      refreshModels();
      onClose();
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