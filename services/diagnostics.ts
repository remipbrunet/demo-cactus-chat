import { getTotalMemory, getUsedMemory } from 'react-native-device-info';
import { getDeviceId } from './storage';
import { supabase } from './supabase';

interface LogChatCompletionDiagnosticsParams {
    llm_model: string;
    tokens_per_second: number;
    time_to_first_token: number;
    generated_tokens: number;
    streaming: boolean;
}

export async function logChatCompletionDiagnostics({llm_model, tokens_per_second, time_to_first_token, generated_tokens, streaming}: LogChatCompletionDiagnosticsParams): Promise<void> {
    getDeviceId().then(async (deviceId) => {
        if (deviceId) {
            await supabase.from('chat_completion_diagnostics').insert({
                device_id: deviceId,
                llm_model: llm_model,
                tokens_per_second: Math.floor(tokens_per_second),
                time_to_first_token_ms: Math.floor(time_to_first_token),
                generated_tokens: Math.floor(generated_tokens),
                streaming: streaming,
                // total_memory: 0,
                // used_memory: 0,
                total_memory: Math.floor(await getTotalMemory()),
                used_memory: Math.floor(await getUsedMemory()),
            })  
        }
    })
}   

export async function logModelLoadDiagnostics({model, loadTime}: {model: string, loadTime: number}): Promise<void> {
    getDeviceId().then(async (deviceId) => {
        if (deviceId) {
            await supabase.from('model_load_diagnostics').insert({
                device_id: deviceId,
                model: model,
                load_time_ms: Math.floor(loadTime),
                // total_memory: 0,
                // used_memory: 0,
                total_memory: Math.floor(await getTotalMemory()),
                used_memory: Math.floor(await getUsedMemory()),
            })
        }
    })
}