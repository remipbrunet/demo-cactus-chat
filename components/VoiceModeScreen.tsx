import { YStack, Button, Text } from 'tamagui';
import { X, Mic, Play } from '@tamagui/lucide-icons'; // Import the X icon
import { useModelContext } from '../contexts/modelContext';
import { generateUniqueId, sendChatMessage } from '../services/chat/chat';
import { Message } from './ChatMessage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { startRecognizing, stopRecognizing, removeEmojis } from '../utils/voiceFunctions';
import Voice, { SpeechResultsEvent, SpeechRecognizedEvent, SpeechEndEvent } from '@react-native-voice/voice';
import Tts from 'react-native-tts'
import { Model } from '@/services/models';
import { createUserMessage, createAIMessage } from './ChatMessage';

// const messagesToSend = [
//   "Why are all the voice assistants still so unreliable in 2025 and don't work offline??",
//   "What can we do to make them better?",
//   "great thanks Cactus, bye!"
// ]

interface VoiceModeOverlayProps {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
}

export const VoiceModeOverlay = ({
  visible,
  onClose,
  messages,
  setMessages,
}: VoiceModeOverlayProps) => {

  const zIndex = 1000;
  const [isListening, setIsListening] = useState(false); // whether the transcription is running
  const [isProcessing, setIsProcessing] = useState(false); // whether the LLM is being invoked
  const [transcribedWords, setTranscribedWords] = useState<string[]>([]); // the transcription results, word by word
  const [aiMessageText, setAiMessageText] = useState<string>(''); // the AI message
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // the error message
  const { selectedModel, tokenGenerationLimit } = useModelContext();
  const transcribedWordsRef = useRef<string[]>([]);
  const selectedModelRef = useRef<Model | null>(selectedModel);

  const appleVoice = 'com.apple.speech.voice.Alex';

  const voiceDebug = useCallback((voiceMessage: string) => {
    Tts.speak(voiceMessage, {
    // Tts.speak(`Invoking ${selectedModel?.value} from ${transcribedWordsRef.current[0]} to ${transcribedWordsRef.current[transcribedWordsRef.current.length - 1]}`, {
      iosVoiceId: appleVoice,
      rate: 0.5,
      androidParams: {
        KEY_PARAM_STREAM: 'STREAM_MUSIC',
        KEY_PARAM_VOLUME: 1.0,
        KEY_PARAM_PAN: 0.0
      }
    });
  }, [transcribedWordsRef.current, selectedModel]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]); // Update ref whenever context value changes

  const invokeLLM = useCallback(async (input: string) => {
    const currentModel = selectedModelRef.current; // <<< Use Ref for model
    
    console.log('CACTUSDEBUG Transcribed Text:', input); // Log the joined results
    setIsProcessing(true);
    if (currentModel) {
      const updatedMessages: Message[] = [...messages, createUserMessage(input, currentModel)];
      setMessages(updatedMessages);
      await sendChatMessage(
        updatedMessages,
        currentModel,
        setAiMessageText,
        (metrics, model, completeMessage) => {
          setIsProcessing(false);
          setMessages([...updatedMessages, createAIMessage(completeMessage, model, metrics)]);
        },
        { streaming: true },
        tokenGenerationLimit
      );
    }
  }, [messages, selectedModelRef, tokenGenerationLimit])//, setMessages, setAiMessageText, setIsProcessing]);

  // const onSpeechResults = async (e: SpeechResultsEvent) => {
  //   // this is technically the final result 
  //   console.log('CACTUSDEBUG onSpeechResults: ', e);
  //   // if (e.value) {
  //   //   await invokeLLM(e.value);
  //   // }
  // };

  // Called when speech recognition encounters an error
  const onSpeechError = useCallback((e: any) => {
    console.error('CACTUSDEBUG onSpeechError: ', e);
    setErrorMessage(JSON.stringify(e.error)); // Store error state
    setIsListening(false); // Ensure listening state is reset on error
    transcribedWordsRef.current = [];
  }, [setErrorMessage, setIsListening]);

  // Called when speech recognition starts successfully
  const onSpeechStart = useCallback((e: any) => {
    console.log('CACTUSDEBUG onSpeechStart: ', e);
    try {Tts.stop()} catch (error) {console.error('Failed to stop TTS: ', error);}
    setErrorMessage(null); // Clear any previous errors
    setIsListening(true); // Set listening state
  }, [setErrorMessage, setIsListening, Tts]);

  // Called when speech recognition ends  TODO: experiment a bit to see if we can speed up inference start time by using this event
  const onSpeechEnd = useCallback(async (e: SpeechEndEvent) => {
    console.log('CACTUSDEBUG onSpeechEnd: ', e);
    setIsListening(false); // Reset listening state
    if (transcribedWordsRef.current.length > 0) {
      await invokeLLM(transcribedWordsRef.current.join(' '));
    }
  }, [setErrorMessage, setIsListening, transcribedWordsRef, invokeLLM]);

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    if (e?.value) {
      transcribedWordsRef.current = e.value;
      setTranscribedWords(e.value);
    }
    console.log('CACTUSDEBUG onSpeechPartialResults: ', e);
  }, []);

  // const onSpeechRecognized = (e: SpeechRecognizedEvent) => {
  //   console.log('CACTUSDEBUG onSpeechRecognized: ', e);
  // };
  
  useEffect(() => {
    // Add listeners
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    // Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    // Voice.onSpeechRecognized = onSpeechRecognized;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(e => console.error("Error destroying voice instance:", e));
    };
  }, [onSpeechStart, onSpeechEnd, onSpeechError, onSpeechPartialResults]);

  useEffect(() => {
    if (!isProcessing && aiMessageText) {
      Tts.speak(removeEmojis(aiMessageText), {
        iosVoiceId: appleVoice,
        rate: 0.5,
        androidParams: {
        KEY_PARAM_STREAM: 'STREAM_MUSIC',
        KEY_PARAM_VOLUME: 1.0,
          KEY_PARAM_PAN: 0.0
        }
      });
    }
  }, [isProcessing]);

  if(!visible) {
    return null;
  }

  return (
    <YStack
      fullscreen 
      key="fullscreen-overlay"
      backgroundColor='$background'
      alignItems="center" 
      justifyContent="center" 
      zIndex={zIndex} 
      gap="$5"
    >
      <Button
        position="absolute"
        top="$10"
        right="$4"
        icon={<X size="$1.5" />} 
        onPress={() => {
          try {Tts.stop()} catch (error) {console.error('Failed to stop TTS: ', error);}
          onClose()
        }}
        chromeless 
        circular 
        size="$3" 
        aria-label="Close overlay" 
        zIndex={zIndex + 1} 
      />

      <YStack 
        position='absolute' 
        top='50%' 
        left='0%' 
        transform={[{ translateY: '-50%' }]}
        gap="$5"
        alignItems="center"
        width="100%"
      >
        <Button
          icon={<Mic size="$10"/>}
          chromeless
          circular
          size="$10" // Keep the visual size
          padding="$2" // Keep the internal padding
          onPressIn={() => {transcribedWordsRef.current = []; setTranscribedWords([]); startRecognizing(setErrorMessage, setIsListening)}}
          onPressOut={() => stopRecognizing(setErrorMessage)}
          // onPress={() => {Tts.stop(); invokeLLM(messagesToSend.shift() || '')}}
          hitSlop={100}
          pressStyle={{ 
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            scale: 1.3
          }}
        />
        {!isListening && <Text textAlign="center">Press and hold to speak</Text>}
        {isListening && <Text textAlign="center">Listening...</Text>}
      </YStack>
      <YStack position='absolute' bottom='20%' width='80%'>
        {/* {transcribedWords && <Text>{transcribedWords.join(' ')}</Text>} */}
        {aiMessageText && <Text textAlign="center">{aiMessageText}</Text>}
        {errorMessage && <Text color="$red10">Error: {errorMessage}</Text>}
        {/* <Button onPress={() => voiceDebug('Hello, Im happy to be helping you out today!')}>Debug</Button> */}
      </YStack>
    </YStack>
  );
};