// Unified Chat Service with MCP Integration
import { Message } from '@/components/ui/chat/ChatMessage';
import { Model } from '../models';
import { ModelMetrics } from '@/utils/modelMetrics';
import { CactusLM } from 'cactus-react-native';
import { mcpClient } from '../mcp/client';
import { MCPToolInvocation } from '../mcp/types';
import { streamLlamaCompletion, ChatProgressCallback, ChatCompleteCallback } from './llama-local';

interface UnifiedChatOptions {
  streaming?: boolean;
  voiceMode?: boolean;
  isReasoningEnabled?: boolean;
  onToolInvocation?: (invocation: MCPToolInvocation) => void;
}

interface ToolCall {
  serverId: string;
  toolName: string;
  arguments: any;
}

/**
 * Detects if the model response contains tool calls
 */
function extractToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Pattern 1: XML-style tool calls
  const xmlPattern = /<tool_call>(.*?)<\/tool_call>/gs;
  const xmlMatches = text.matchAll(xmlPattern);
  
  for (const match of xmlMatches) {
    try {
      // Clean up the JSON (remove newlines, extra spaces)
      const jsonStr = match[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      console.log('[MCP] Attempting to parse tool call JSON:', jsonStr);
      const toolData = JSON.parse(jsonStr);
      
      // Try to match the tool to a connected server
      const servers = mcpClient.getConnectedServers();
      for (const server of servers) {
        const tool = server.tools?.find(t => t.name === toolData.name);
        if (tool) {
          console.log('[MCP] Matched tool to server:', server.name, 'tool:', toolData.name);
          toolCalls.push({
            serverId: server.id,
            toolName: toolData.name,
            arguments: toolData.arguments || {},
          });
          break;
        }
      }
    } catch (error) {
      console.error('[MCP] Failed to parse tool call:', error, 'Match:', match[1]);
    }
  }
  
  // No fallback patterns - if the model doesn't generate proper tool calls, that's a failure
  
  return toolCalls;
}

/**
 * Formats available tools for inclusion in the system prompt
 */
function formatToolsForPrompt(): string {
  const servers = mcpClient.getConnectedServers();
  if (servers.length === 0) return '';
  
  let toolsDescription = '\n\n## MCP TOOL CALLING INSTRUCTIONS\n\n';
  toolsDescription += 'YOU CAN AND MUST USE TOOLS. You have the ability to call external tools.\n';
  toolsDescription += 'NEVER say "I cannot call the MCP server". You CAN call it using the format below.\n\n';
  toolsDescription += '### REQUIRED FORMAT (use exactly this syntax):\n';
  toolsDescription += '<tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>\n\n';
  
  toolsDescription += '### AVAILABLE TOOLS:\n';
  for (const server of servers) {
    if (server.tools && server.tools.length > 0) {
      toolsDescription += `\n**${server.name} Server Tools:**\n`;
      for (const tool of server.tools) {
        toolsDescription += `- ${tool.name}\n`;
        
        // For Context7 tools, add specific examples
        if (tool.name === 'resolve-library-id') {
          toolsDescription += '  Usage: <tool_call>{"name": "resolve-library-id", "arguments": {"libraryName": "YOUR_LIBRARY"}}</tool_call>\n';
        } else if (tool.name === 'get-library-docs') {
          toolsDescription += '  Usage: <tool_call>{"name": "get-library-docs", "arguments": {"context7CompatibleLibraryID": "/org/library"}}</tool_call>\n';
        }
      }
      toolsDescription += '\n';
    }
  }
  
  toolsDescription += '### EXAMPLE:\n';
  toolsDescription += 'User: "How does jinja2 handle templates?"\n';
  toolsDescription += 'You: Let me look that up for you.\n';
  toolsDescription += '<tool_call>{"name": "resolve-library-id", "arguments": {"libraryName": "jinja2"}}</tool_call>\n\n';
  
  toolsDescription += 'IMPORTANT: When asked about any library or when a user mentions an MCP server, ';
  toolsDescription += 'you MUST use the tool call format above. Do NOT say you cannot call the server.\n';
  
  return toolsDescription;
}

/**
 * Checks if a model supports tool calling
 */
export function modelSupportsTools(model: Model): boolean {
  if (!model) {
    console.log('[MCP] Model is undefined');
    return false;
  }
  
  // Model uses 'value' field for the model name
  const modelName = (model.value || model.label || '').toLowerCase();
  
  if (!modelName) {
    console.log('[MCP] Model name is empty');
    return false;
  }
  
  console.log('[MCP] Checking tool support for model:', modelName);
  
  // Models specifically designed for tool/function calling
  if (modelName.includes('tool') || modelName.includes('function')) {
    console.log('[MCP] Model supports tools: Tool/Function calling model detected');
    return true;
  }
  
  // Specific tool-calling models
  if (modelName.includes('xlam') || 
      modelName.includes('arch-function') ||
      modelName.includes('hammer') ||
      modelName.includes('grok')) {  // Baby Grok3 is based on Hammer
    console.log('[MCP] Model supports tools: Specialized tool-calling model detected');
    return true;
  }
  
  // Llama 3.2 with tool calling support
  if (modelName.includes('llama') && modelName.includes('3.2') && modelName.includes('tool')) {
    console.log('[MCP] Model supports tools: Llama 3.2 Tool Calling detected');
    return true;
  }
  
  // Note: Qwen 2.5 models don't properly support tool calling despite claims
  // Keeping this commented out as documentation
  // if (modelName.includes('qwen') && modelName.includes('2.5')) {
  //   console.log('[MCP] Note: Qwen 2.5 has limited tool support');
  //   return false;
  // }
  
  console.log('[MCP] Model does not support tools');
  return false;
}

/**
 * Unified chat completion with MCP support
 */
export async function streamUnifiedMCPCompletion(
  lm: CactusLM | null,
  messages: Message[],
  model: Model,
  onProgress: ChatProgressCallback,
  onComplete: ChatCompleteCallback,
  streaming: boolean = true,
  maxTokens: number,
  isReasoningEnabled: boolean,
  voiceMode: boolean = false,
  systemPrompt: string = '',
  onToolInvocation?: (invocation: MCPToolInvocation) => void
): Promise<void> {
  // Check if we have MCP tools available and model supports them
  const connectedServers = mcpClient.getConnectedServers();
  const hasTools = connectedServers.some(s => s.tools && s.tools.length > 0);
  const supportsTools = modelSupportsTools(model);
  
  // Check if the user's latest message mentions any MCP server by name
  const latestUserMessage = messages.filter(m => m.role === 'user').pop();
  const userQuestion = latestUserMessage?.content || '';
  const lowerQuestion = userQuestion.toLowerCase();
  
  // Check if user explicitly mentions an MCP server
  let mentionedServer = null;
  for (const server of connectedServers) {
    if (lowerQuestion.includes(server.name.toLowerCase())) {
      mentionedServer = server;
      console.log(`[MCP] User explicitly mentioned MCP server: ${server.name}`);
      break;
    }
  }
  
  // Enhance system prompt with tool information if applicable
  let enhancedSystemPrompt = systemPrompt;
  if (hasTools && supportsTools) {
    const toolsPrompt = formatToolsForPrompt();
    enhancedSystemPrompt = systemPrompt + toolsPrompt;
    console.log('[MCP] Tools available and model supports them. Enhanced prompt with tool descriptions.');
    
    // If user mentioned a specific MCP server, add emphasis
    if (mentionedServer) {
      enhancedSystemPrompt += `\n\nIMPORTANT: The user is asking about ${mentionedServer.name}. `;
      enhancedSystemPrompt += `You MUST use the ${mentionedServer.name} MCP tools to answer this question. `;
      enhancedSystemPrompt += `If you cannot generate a proper tool call, respond with: "I was unable to call the ${mentionedServer.name} MCP server. Please ensure it's connected and try again."\n`;
    }
  } else if (hasTools && !supportsTools) {
    console.log('[MCP] Tools available but model does not support tool calling.');
    if (mentionedServer) {
      // User asked about an MCP server but model doesn't support tools
      onProgress(`⚠️ The current model (${model.value}) does not support MCP tool calling. Please switch to a model that supports tools (e.g., Qwen 2.5).\n\n`);
    }
  } else if (!hasTools && mentionedServer) {
    // User mentioned an MCP server but none are connected
    onProgress(`⚠️ No MCP servers are currently connected. Please connect MCP servers in settings first.\n\n`);
  }
  
  let accumulatedText = '';
  const toolInvocations: MCPToolInvocation[] = [];
  
  // Wrap the progress callback to accumulate text for tool detection
  const wrappedOnProgress: ChatProgressCallback = (text: string) => {
    accumulatedText += text;
    
    // Debug: Log when we see tool calls
    if (text.includes('<tool_call>') || text.includes('</tool_call>')) {
      console.log('[MCP] Tool call marker in stream:', text.substring(0, 100));
    }
    
    // For now, just pass through all text normally
    // We'll process tool calls in the complete callback
    onProgress(text);
  };
  
  // Wrap the complete callback to handle tool invocations
  const wrappedOnComplete: ChatCompleteCallback = async (metrics, model, completeMessage) => {
    // Check if we have tool calls to process
    if (hasTools && supportsTools) {
      const toolCalls = extractToolCalls(accumulatedText);
      
      if (toolCalls.length > 0) {
        console.log(`[MCP] Processing ${toolCalls.length} tool call(s)`);
        console.log('[MCP] Full response:', accumulatedText.substring(0, 500));
        
        // Extract the text before the tool call (model's introduction)
        const toolCallIndex = accumulatedText.indexOf('<tool_call>');
        let preToolText = '';
        let postToolText = '';
        
        if (toolCallIndex > 0) {
          preToolText = accumulatedText.substring(0, toolCallIndex).trim();
        }
        
        // Find any text after the last </tool_call> tag
        const lastToolCallEnd = accumulatedText.lastIndexOf('</tool_call>');
        if (lastToolCallEnd !== -1) {
          postToolText = accumulatedText.substring(lastToolCallEnd + '</tool_call>'.length).trim();
        }
        
        // Clear the message and show clean formatting
        // Note: The tool call XML will have been shown in the stream, 
        // so we add the visual indicator after it
        
        // Add visual indicator that tools are being invoked
        onProgress('\n\n---\n🔧 Invoking MCP tools...\n');
        
        for (const call of toolCalls) {
          try {
            // Show which tool is being called
            const callingText = `\n📡 Calling ${call.toolName}...`;
            console.log('[MCP] About to call tool:', call.toolName, 'with args:', call.arguments);
            onProgress(callingText);
            
            console.log('[MCP] Invoking tool via mcpClient.callTool...');
            const invocation = await mcpClient.callTool(
              call.serverId,
              call.toolName,
              call.arguments
            );
            console.log('[MCP] Tool invocation result:', invocation.status);
            
            toolInvocations.push(invocation);
            onToolInvocation?.(invocation);
            
            // Format and display the tool result
            if (invocation.status === 'completed' && invocation.result) {
              let resultText = '';
              
              // Special formatting for Context7 results
              if (call.toolName === 'get-library-docs' && invocation.result.content) {
                resultText = `\n✅ Documentation retrieved:\n\n${invocation.result.content}\n`;
              } else if (call.toolName === 'resolve-library-id' && Array.isArray(invocation.result)) {
                resultText = '\n✅ Found libraries:\n';
                invocation.result.forEach((lib: any) => {
                  resultText += `  • ${lib.name} (${lib.id})\n`;
                });
              } else {
                resultText = `\n✅ Tool result:\n${
                  typeof invocation.result === 'string' 
                    ? invocation.result 
                    : JSON.stringify(invocation.result, null, 2)
                }\n`;
              }
              
              onProgress(resultText);
              accumulatedText += resultText;
            } else if (invocation.status === 'error') {
              const errorText = `\n❌ Tool error: ${invocation.error}\n`;
              onProgress(errorText);
              accumulatedText += errorText;
            }
          } catch (error) {
            console.error('Tool invocation failed:', error);
            const errorText = `\n❌ Failed to invoke ${call.toolName}: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
            onProgress(errorText);
            accumulatedText += errorText;
          }
        }
        
        onProgress('\n---\n');
        
        // Add any post-tool text from the model if it exists
        if (postToolText) {
          onProgress('\n' + postToolText);
          accumulatedText += '\n' + postToolText;
        }
      }
    }
    
    // Call the original complete callback
    onComplete(metrics, model, accumulatedText);
  };
  
  // Store the mentioned server for the completion callback
  const contextData = { mentionedServer };
  
  // Wrap the complete callback with server context
  const wrappedCompleteWithContext: ChatCompleteCallback = async (metrics, model, completeMessage) => {
    // Check if user mentioned an MCP server but no tools were called
    if (contextData.mentionedServer && hasTools && supportsTools) {
      const toolCalls = extractToolCalls(accumulatedText);
      if (toolCalls.length === 0) {
        console.log(`[MCP] User mentioned ${contextData.mentionedServer.name} but no tool calls were generated`);
        const warningText = `\n\n⚠️ I was unable to call the ${contextData.mentionedServer.name} MCP server. The model did not generate proper tool calls.\n`;
        onProgress(warningText);
        accumulatedText += warningText;
      }
    }
    
    // Call the original wrapped complete callback
    return wrappedOnComplete(metrics, model, completeMessage);
  };
  
  // Use the base Llama completion with our wrapped callbacks
  return streamLlamaCompletion(
    lm,
    messages,  // Use original messages, no pre-fetching
    model,
    wrappedOnProgress,
    wrappedCompleteWithContext,
    streaming,
    maxTokens,
    isReasoningEnabled,
    voiceMode,
    enhancedSystemPrompt
  );
}