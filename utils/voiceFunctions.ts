import { PermissionsAndroid, Platform } from 'react-native';
// import Voice, { SpeechRecognizedEvent, SpeechResultsEvent } from '@react-native-voice/voice';

/**
 * Removes emojis from a string.
 * @param text - The string to remove emojis from.
 * @returns The string with emojis removed.
 */
export function removeEmojis(text: string): string {
  // Regular expression to match most emojis and emoji sequences:
  // \p{Emoji_Presentation}: Matches characters explicitly intended as emoji.
  // \p{Extended_Pictographic}: Matches a broader category including many symbols that might be rendered as emoji.
  // The 'u' flag enables Unicode property escapes (\p{}).
  // The 'g' flag ensures all occurrences globally in the string are replaced.
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

  // Replace matches with an empty string
  return text.replace(emojiRegex, '');
}

export const requestMicrophonePermission = async (setError: (error: string) => void): Promise<boolean> => {
    if (Platform.OS === 'android') {
       try {
           const granted = await PermissionsAndroid.request(
               PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
               {
                   title: 'Microphone Permission',
                   message: 'This app needs access to your microphone to recognize speech.',
                   buttonNeutral: 'Ask Me Later',
                   buttonNegative: 'Cancel',
                   buttonPositive: 'OK',
               },
           );
           if (granted === PermissionsAndroid.RESULTS.GRANTED) {
               console.log('Microphone permission granted');
               return true;
           } else {
               console.log('Microphone permission denied');
               setError('Microphone permission denied');
               return false;
           }
       } catch (err) {
           console.warn(err);
           setError('Error requesting microphone permission');
           return false;
       }
   }
   // For iOS, permission is typically requested implicitly when starting audio services.
   // Might need to add NSMicrophoneUsageDescription to your Info.plist.
   return true;
 };

/**
 * Starts the voice recognizer.
 */
 export const startRecognizing = async (
    setError: (error: string | null) => void, 
    setIsListening: (isListening: boolean) => void
) => {
    const hasPermission = await requestMicrophonePermission(setError);
    if (!hasPermission) {
        return; // Don't start if permission is not granted
    }

    setError(null);
    setIsListening(false); // Reset just in case

    try {
      await Voice.start('en-US');
      console.log('Started recognizing...');
    } catch (e) {
      console.error('Error starting recognition:', e);
      setError(JSON.stringify(e));
    }
};

/**
 * Stops the voice recognizer.
 */
export const stopRecognizing = async (
    setError: (error: string | null) => void, 
) => {
    try {
      await Voice.stop();
      console.log('Stopped recognizing.');
    } catch (e) {
      console.error('Error stopping recognition:', e);
      setError(JSON.stringify(e));
    }
  };

  /**
   * Cancels the voice recognizer.
   * Manually resets the listening state as onSpeechEnd might not fire.
   */
  const cancelRecognizing = async (
    setError: (error: string | null) => void, 
    setIsListening: (isListening: boolean) => void
) => {
    try {
      await Voice.cancel();
      console.log('Cancelled recognition.');
      setIsListening(false); // Manually reset state as onSpeechEnd might not fire
    } catch (e) {
      console.error('Error cancelling recognition:', e);
      setError(JSON.stringify(e));
    }
  };

  /**
   * Destroys the voice recognizer instance.
   * Generally called during cleanup, but can be called manually.
   */
  const destroyRecognizer = async (
    setError: (error: string | null) => void, 
    setResults: (results: string[]) => void, 
    setIsListening: (isListening: boolean) => void
) => {
    try {
      await Voice.destroy();
      console.log('Destroyed recognizer.');
      setResults([]);
      setError(null);
      setIsListening(false);
    } catch (e) {
      console.error('Error destroying recognizer:', e);
      setError(JSON.stringify(e));
    }
  }; 