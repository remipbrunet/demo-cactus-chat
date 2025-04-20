import { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import Voice, { SpeechRecognizedEvent, SpeechResultsEvent } from '@react-native-voice/voice';


export const VoiceLogger = () => {
  const [results, setResults] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    
    const onSpeechResults = (e: any) => {
      console.log('onSpeechResults: ', e);
      if (e.value) {
        setResults(e.value); // Update state with results
        console.log('Transcribed Text:', e.value.join(' ')); // Log the joined results
      }
    };

    // Called when speech recognition encounters an error
    const onSpeechError = (e: any) => {
      console.error('onSpeechError: ', e);
      setError(JSON.stringify(e.error)); // Store error state
      setIsListening(false); // Ensure listening state is reset on error
    };

    // Called when speech recognition starts successfully
    const onSpeechStart = (e: any) => {
      console.log('onSpeechStart: ', e);
      setError(null); // Clear any previous errors
      setIsListening(true); // Set listening state
    };

    // Called when speech recognition ends
    const onSpeechEnd = (e: any) => {
      console.log('onSpeechEnd: ', e);
      setIsListening(false); // Reset listening state
    };

    const onSpeechPartialResults = (e: SpeechResultsEvent) => {
      console.log('onSpeechPartialResults: ', e);
    };

    const onSpeechRecognized = (e: SpeechRecognizedEvent) => {
      console.log('onSpeechRecognized: ', e);
    };

    // Add listeners
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechRecognized = onSpeechRecognized;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(e => console.error("Error destroying voice instance:", e));
    };
  }, []); // Empty dependency array ensures this runs only once on mount and cleanup on unmount

  const requestMicrophonePermission = async (): Promise<boolean> => {
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

  const startRecognizing = async () => {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
        return; // Don't start if permission is not granted
    }

    setResults([]);
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

  const stopRecognizing = async () => {
    try {
      await Voice.stop();
      console.log('Stopped recognizing.');
    } catch (e) {
      console.error('Error stopping recognition:', e);
      setError(JSON.stringify(e));
    }
  };

  const cancelRecognizing = async () => {
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
  const destroyRecognizer = async () => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>
        {isListening ? 'Listening...' : 'Press Start Listening'}
      </Text>
      <View style={styles.buttonContainer}>
        <Button
          title={isListening ? "Stop Listening" : "Start Listening"}
          onPress={isListening ? stopRecognizing : startRecognizing}
          disabled={!isListening && results.length > 0 && Platform.OS === 'ios'} // iOS might need explicit stop sometimes
        />
        {/* Optional: Add Cancel and Destroy buttons for testing */}
        {/* <Button title="Cancel" onPress={cancelRecognizing} disabled={!isListening} /> */}
        {/* <Button title="Destroy" onPress={destroyRecognizer} /> */}
      </View>
      <Text style={styles.header}>Results:</Text>
      {results.map((result, index) => (
        <Text key={`result-${index}`} style={styles.resultText}>{result}</Text>
      ))}
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
    </View>
  );
};

// Basic styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5', // Light background
  },
  buttonContainer: {
    flexDirection: 'row', // Arrange buttons horizontally
    justifyContent: 'space-around', // Space out buttons
    width: '80%', // Limit width
    marginVertical: 20, // Add vertical spacing
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333', // Darker text
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 5,
    alignSelf: 'flex-start', // Align header left
    marginLeft: '10%', // Indent slightly
    color: '#555',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
    alignSelf: 'flex-start',
    marginLeft: '10%',
    color: '#000', // Black text for results
  },
  errorText: {
    fontSize: 14,
    color: 'red', // Red for errors
    marginTop: 10,
    alignSelf: 'flex-start',
    marginLeft: '10%',
  },
});