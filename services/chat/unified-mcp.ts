// Unified Chat Service with MCP Integration
import { Message } from '@/components/ui/chat/ChatMessage';
import { Model } from '../models';
import { ModelMetrics } from '@/utils/modelMetrics';
import { CactusLM } from 'cactus-react-native';
import { mcpClient } from '../mcp/client';
import { MCPToolInvocation } from '../mcp/types';
import { streamLlamaCompletion, ChatProgressCallback, ChatCompleteCallback } from './llama-local';
import { selectToolForQuery, detectExplicitToolRequest, ToolMatch } from './tool-selection';
import { buildHammerToolPrompt, cleanStreamingJson } from './hammer-prompt-builder';

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
 * Hammer model uses JSON format, potentially in markdown code blocks
 */
function extractToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Helper function to process a tool call
  const processToolCall = (toolData: any) => {
    // Check if toolData exists and is valid
    if (!toolData || typeof toolData !== 'object') {
      console.error('[MCP] Invalid tool call format - toolData is not an object:', toolData);
      return;
    }
    
    if (!toolData.name || typeof toolData.name !== 'string') {
      console.error('[MCP] Invalid tool call format - missing or invalid name field:', toolData);
      return;
    }
    
    // Try to match the tool to a connected server
    const servers = mcpClient.getConnectedServers();
    let toolFound = false;
    
    for (const server of servers) {
      const tool = server.tools?.find(t => t.name === toolData.name);
      if (tool) {
        console.log('[MCP] Matched tool to server:', server.name, 'tool:', toolData.name);
        toolCalls.push({
          serverId: server.id,
          toolName: toolData.name,
          arguments: toolData.arguments || {},
        });
        toolFound = true;
        break;
      }
    }
    
    if (!toolFound) {
      console.error('[MCP] Tool not found in any connected server:', toolData.name);
      console.log('[MCP] Available tools:', servers.flatMap(s => s.tools?.map(t => t.name) || []));
    }
  };
  
  // Pattern 1: JSON in markdown code blocks (Hammer's preferred format)
  // The accumulated text contains streaming artifacts, so we need to extract the final JSON
  const codeBlockPattern = /```(?:json)?\s*\n?([\s\S]*?)\s*\n?```/g;
  const codeBlockMatches = text.matchAll(codeBlockPattern);
  
  for (const match of codeBlockMatches) {
    try {
      let jsonContent = match[1].trim();
      
      // The streaming creates repeated partial JSON like:
      // {"name": "Context
      // {"name": "Context7
      // {"name": "Context7", "arguments": {...}}
      // We need to extract just the last complete JSON
      
      // Find the last complete JSON object by looking for balanced braces
      let lastValidJson = '';
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let jsonStart = -1;
      
      for (let i = jsonContent.length - 1; i >= 0; i--) {
        const char = jsonContent[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '}') {
            if (braceCount === 0) {
              // Found the end of a JSON object
              lastValidJson = jsonContent.substring(0, i + 1);
            }
            braceCount++;
          } else if (char === '{') {
            braceCount--;
            if (braceCount === 0 && lastValidJson) {
              // Found the matching start brace
              jsonStart = i;
              break;
            }
          }
        }
      }
      
      if (jsonStart >= 0 && lastValidJson) {
        const finalJson = jsonContent.substring(jsonStart);
        console.log('[MCP] Extracted final JSON from streaming:', finalJson);
        try {
          const toolData = JSON.parse(finalJson);
          processToolCall(toolData);
        } catch (parseErr) {
          console.error('[MCP] Failed to parse extracted JSON:', parseErr);
          console.error('[MCP] JSON content was:', finalJson);
        }
      } else {
        // Try our cleaner function as fallback
        const cleanedJson = cleanStreamingJson(jsonContent);
        if (cleanedJson) {
          console.log('[MCP] Cleaned JSON from streaming:', cleanedJson);
          try {
            const toolData = JSON.parse(cleanedJson);
            processToolCall(toolData);
          } catch (parseErr) {
            console.error('[MCP] Failed to parse cleaned JSON:', parseErr);
            console.error('[MCP] Cleaned JSON was:', cleanedJson);
          }
        }
      }
    } catch (error) {
      console.log('[MCP] Failed to parse code block JSON:', error);
      console.log('[MCP] Raw content:', match[1].substring(0, 200));
    }
  }
  
  // Pattern 2: Bare JSON objects (fallback for simpler responses)
  if (toolCalls.length === 0) {
    // Find the LAST complete JSON object (to avoid duplicates from streaming)
    const bareJsonPattern = /\{[^{}]*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^{}]*\}\s*\}/g;
    const bareJsonMatches = Array.from(text.matchAll(bareJsonPattern));
    
    // Only process the last match to avoid duplicates
    if (bareJsonMatches.length > 0) {
      const lastMatch = bareJsonMatches[bareJsonMatches.length - 1];
      try {
        const jsonStr = lastMatch[0].trim();
        console.log('[MCP] Found bare JSON tool call:', jsonStr);
        const toolData = JSON.parse(jsonStr);
        if (toolData) {
          processToolCall(toolData);
        } else {
          console.error('[MCP] Parsed JSON resulted in null/undefined');
        }
      } catch (error) {
        console.log('[MCP] Failed to parse bare JSON:', error);
        console.log('[MCP] JSON string was:', lastMatch[0]);
      }
    }
  }
  
  return toolCalls;
}

/**
 * Formats a specific tool prompt when we've identified the right tool via keywords
 */
function formatSpecificToolPrompt(match: ToolMatch, servers: any[], userMessage?: string): string {
  const server = servers.find(s => s.id === match.serverId);
  if (!server || !server.tools) return '';
  
  const tool = server.tools.find((t: any) => t.name === match.toolName);
  if (!tool) return '';
  
  let prompt = '\n\n## IMPORTANT: USE THIS SPECIFIC TOOL\n\n';
  prompt += `You MUST use the "${tool.name}" tool to answer this question.\n`;
  prompt += 'DO NOT use any other tool.\n\n';
  prompt += 'Output ONLY this JSON (replace the parameter values):\n';
  prompt += '```json\n';
  
  // Create example with actual values from the query
  const example: any = {
    name: tool.name,
    arguments: {}
  };
  
  // Better parameter extraction based on tool type
  if (tool.inputSchema?.properties) {
    const required = tool.inputSchema.required || [];
    
    for (const param of required) {
      if (param === 'libraryName') {
        // For React hooks question, extract "React"
        if (match.suggestedPrompt?.toLowerCase().includes('react')) {
          example.arguments[param] = 'react';
        } else {
          example.arguments[param] = match.suggestedPrompt || 'library_from_question';
        }
      } else if (param === 'query') {
        example.arguments[param] = match.suggestedPrompt || userMessage;
      } else if (param === 'context7CompatibleLibraryID') {
        example.arguments[param] = '/facebook/react';  // Common example
      } else if (param === 'topic') {
        // Extract topic from query
        if (match.suggestedPrompt?.toLowerCase().includes('hook')) {
          example.arguments[param] = 'hooks';
        } else {
          example.arguments[param] = 'relevant_topic';
        }
      } else {
        example.arguments[param] = `${param}_value`;
      }
    }
  }
  
  prompt += JSON.stringify(example, null, 2);
  prompt += '\n```\n\n';
  prompt += 'Remember: Output ONLY the JSON above with appropriate values. Nothing else.\n';
  
  return prompt;
}

/**
 * Formats available tools for inclusion in the system prompt
 * Uses keyword-based selection for Hammer 2.1 static tool calling
 */
function formatToolsForPrompt(userMessage?: string): string {
  const servers = mcpClient.getConnectedServers();
  if (servers.length === 0) return '';
  
  // If we have a user message, try keyword-based selection first
  if (userMessage) {
    console.log('[MCP] Analyzing query for tool selection:', userMessage);
    
    // Check for explicit tool request
    const explicitMatch = detectExplicitToolRequest(userMessage);
    if (explicitMatch) {
      console.log('[MCP] Explicit tool match:', explicitMatch);
      return formatSpecificToolPrompt(explicitMatch, servers, userMessage);
    }
    
    // Try automatic keyword matching
    const autoMatch = selectToolForQuery(userMessage);
    console.log('[MCP] Auto-match result:', autoMatch);
    
    // Lower threshold to 20 for better matching
    if (autoMatch && autoMatch.confidence > 20) {
      console.log('[MCP] Using keyword-selected tool:', autoMatch.toolName);
      return formatSpecificToolPrompt(autoMatch, servers, userMessage);
    }
  }
  
  // Fallback to generic tool listing (kept minimal for Hammer 2.1)
  let toolsDescription = '\n\n## TOOLS\n\n';
  toolsDescription += 'When you need to call a tool, output ONLY this JSON format:\n';
  toolsDescription += '```json\n';
  toolsDescription += '{"name": "ACTUAL_TOOL_NAME", "arguments": {...}}\n';
  toolsDescription += '```\n\n';
  toolsDescription += 'IMPORTANT: Use the exact tool name (e.g., "resolve-library-id", "microsoft_docs_search"), NOT the server name!\n\n';
  toolsDescription += 'Available tools:\n\n';
  
  // List all tools generically without any hardcoded logic
  for (const server of servers) {
    if (server.tools && server.tools.length > 0) {
      toolsDescription += `From ${server.name} server:\n`;
      
      for (const tool of server.tools) {
        toolsDescription += `• Tool name: "${tool.name}"`;
        
        // Truncate description to first sentence or 150 chars for brevity
        if (tool.description) {
          let shortDesc = tool.description;
          // Find first sentence
          const firstPeriod = shortDesc.indexOf('. ');
          if (firstPeriod > 0 && firstPeriod < 150) {
            shortDesc = shortDesc.substring(0, firstPeriod + 1);
          } else if (shortDesc.length > 150) {
            shortDesc = shortDesc.substring(0, 147) + '...';
          }
          toolsDescription += ` - ${shortDesc}`;
        }
        toolsDescription += '\n';
        
        // Only show required parameters to keep it simple
        if (tool.inputSchema?.properties) {
          const required = tool.inputSchema.required || [];
          if (required.length > 0) {
            toolsDescription += `  Required: `;
            toolsDescription += required.join(', ');
            toolsDescription += '\n';
            
            // Simple example with just the tool name and required params
            const exampleArgs: any = {};
            for (const param of required) {
              const paramSchema = (tool.inputSchema.properties as any)[param];
              if (paramSchema?.type === 'string') {
                // Use the parameter name as a hint for what to put
                exampleArgs[param] = param.toLowerCase();
              } else if (paramSchema?.type === 'number') {
                exampleArgs[param] = 1;
              } else if (paramSchema?.type === 'boolean') {
                exampleArgs[param] = true;
              } else {
                exampleArgs[param] = param.toLowerCase();
              }
            }
            
            const exampleJson = JSON.stringify({
              name: tool.name,
              arguments: exampleArgs
            }, null, 2);
            
            toolsDescription += '  Example:\n  ```json\n  ' + exampleJson.split('\n').join('\n  ') + '\n  ```\n';
          }
        }
      }
      toolsDescription += '\n';
    }
  }
  
  toolsDescription += '\nTool Selection Rules:\n';
  toolsDescription += '1. If the user mentions a specific server name, you MUST use tools from that server only\n';
  toolsDescription += '2. Match what the user says to the server names shown above (case-insensitive)\n';
  toolsDescription += '3. If no server is specified, choose based on the type of request\n';
  
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
  
  // Get the latest user message for keyword-based tool selection
  const latestUserMessage = messages.filter(m => m.role === 'user' || m.isUser).pop();
  // The Message interface uses 'text' not 'content'
  let userQuestion = latestUserMessage?.text || latestUserMessage?.content || '';
  
  // Strip the /no_think prefix if present (added by the app)
  if (userQuestion.startsWith('/no_think')) {
    userQuestion = userQuestion.replace('/no_think', '').trim();
  }
  
  console.log('[MCP] User question for tool selection:', userQuestion);
  
  // Enhance system prompt with tool information if applicable
  let enhancedSystemPrompt = systemPrompt;
  if (hasTools && supportsTools) {
    // Use Hammer-specific prompt builder for better tool selection
    const toolsPrompt = buildHammerToolPrompt(userQuestion, connectedServers);
    enhancedSystemPrompt = systemPrompt + toolsPrompt;
    console.log('[MCP] Tools available and model supports them. Using Hammer-specific prompt for:', userQuestion);
  } else if (hasTools && !supportsTools) {
    console.log('[MCP] Tools available but model does not support tool calling.');
    
    // Only warn if the user seems to be asking about something that might need tools
    // But don't try to detect specific servers - stay generic
    if (userQuestion.toLowerCase().includes('documentation') || 
        userQuestion.toLowerCase().includes('api') ||
        userQuestion.toLowerCase().includes('how to') ||
        userQuestion.toLowerCase().includes('search')) {
      onProgress(`ℹ️ Note: The current model (${model.value}) does not support MCP tool calling. If you need to use external tools, please switch to a model that supports tools (e.g., Hammer 2.1).\n\n`);
    }
  } else if (!hasTools) {
    console.log('[MCP] No MCP servers are currently connected.');
  }
  
  let accumulatedText = '';
  const toolInvocations: MCPToolInvocation[] = [];
  let isProcessingToolCall = false;
  let toolCallStartIndex = -1;
  
  // Wrap the progress callback to accumulate text for tool detection
  const wrappedOnProgress: ChatProgressCallback = (text: string) => {
    accumulatedText += text;
    
    // If we're already processing a tool call, just accumulate
    if (isProcessingToolCall) {
      console.log('[MCP] Suppressing output during tool call processing');
      return;
    }
    
    // Check if we're starting a tool call in the accumulated text
    if (hasTools && supportsTools && !isProcessingToolCall) {
      // Look for the start of a JSON code block in accumulated text
      const jsonBlockIndex = accumulatedText.indexOf('```json');
      const bareBlockIndex = accumulatedText.indexOf('```\n{');
      
      if (jsonBlockIndex !== -1 || bareBlockIndex !== -1) {
        isProcessingToolCall = true;
        toolCallStartIndex = Math.min(
          jsonBlockIndex !== -1 ? jsonBlockIndex : Infinity,
          bareBlockIndex !== -1 ? bareBlockIndex : Infinity
        );
        
        console.log('[MCP] Tool call detected at index:', toolCallStartIndex);
        console.log('[MCP] Accumulated text preview:', accumulatedText.substring(Math.max(0, toolCallStartIndex - 50), toolCallStartIndex + 100));
        
        // Show any text before the tool call
        if (toolCallStartIndex > 0) {
          const preText = accumulatedText.substring(0, toolCallStartIndex).trim();
          if (preText && !preText.endsWith('🔧 Processing tool request...')) {
            // Don't show the pre-text, it's already been streamed
            console.log('[MCP] Pre-tool text already shown via streaming');
          }
        }
        
        // Show that we're processing a tool call
        onProgress('\n\n🔧 Processing tool request...\n');
        console.log('[MCP] Tool call detected (JSON format), suppressing streaming output');
        return;
      }
    }
    
    // Normal streaming - pass through text
    onProgress(text);
  };
  
  // Wrap the complete callback to handle tool invocations
  const wrappedOnComplete: ChatCompleteCallback = async (metrics, model, completeMessage) => {
    console.log('[MCP] Complete callback triggered. Accumulated text length:', accumulatedText.length);
    console.log('[MCP] Accumulated text preview:', accumulatedText.substring(0, 200));
    
    // Check if we have tool calls to process
    if (hasTools && supportsTools) {
      // First check if the model tried to call a tool (look for JSON code blocks or bare JSON)
      const hasToolCallAttempt = accumulatedText.includes('```json') || 
                                 accumulatedText.includes('```\n{') ||
                                 accumulatedText.includes('"name"') && accumulatedText.includes('"arguments"');
      
      console.log('[MCP] Has tool call attempt:', hasToolCallAttempt);
      
      if (hasToolCallAttempt) {
        const toolCalls = extractToolCalls(accumulatedText);
        
        if (toolCalls.length > 0) {
          console.log(`[MCP] Processing ${toolCalls.length} tool call(s)`);
          console.log('[MCP] Tool calls:', toolCalls);
          
          // Show we're invoking the tools
          onProgress('📡 Calling tools...\n');
          
          // Store tool results
          let toolResults: string[] = [];
          
          for (const call of toolCalls) {
            try {
              console.log('[MCP] Invoking tool:', call.toolName, 'with args:', call.arguments);
              
              const invocation = await mcpClient.callTool(
                call.serverId,
                call.toolName,
                call.arguments
              );
              console.log('[MCP] Tool invocation result:', invocation.status);
              
              toolInvocations.push(invocation);
              onToolInvocation?.(invocation);
              
              // Collect the tool result
              if (invocation.status === 'completed' && invocation.result) {
                // Format the result based on the tool type
                let formattedResult = '';
                
                // DEBUG: Log the actual structure
                console.log('[MCP] Result type:', typeof invocation.result);
                console.log('[MCP] Result has content?:', 'content' in invocation.result);
                console.log('[MCP] Result preview:', JSON.stringify(invocation.result).substring(0, 200));
                
                // Check if this is an error response
                if (invocation.result.isError) {
                  // Handle error response from MCP server
                  if (invocation.result.content && Array.isArray(invocation.result.content)) {
                    // Extract error messages from content array
                    formattedResult = invocation.result.content.map((item: any) => 
                      item.text || JSON.stringify(item)
                    ).join('\n');
                  } else if (invocation.result.content) {
                    formattedResult = `Error: ${invocation.result.content}`;
                  } else {
                    formattedResult = `Error: ${JSON.stringify(invocation.result)}`;
                  }
                } else if (typeof invocation.result === 'string') {
                  // CRITICAL FIX: Check if the string is actually JSON that needs parsing
                  console.log('[MCP] Result is string, checking if JSON:', invocation.result.substring(0, 100));
                  if (invocation.result.startsWith('[{') || invocation.result.startsWith('{')) {
                    console.log('[MCP] String looks like JSON, parsing it...');
                    try {
                      const parsed = JSON.parse(invocation.result);
                      
                      // Handle parsed array
                      if (Array.isArray(parsed)) {
                        const items = parsed.slice(0, 3);
                        formattedResult = items.map((item: any) => {
                          if (item.title && item.content) {
                            // Just return the content, skip the title
                            let content = item.content;
                            // Clean up formatting
                            content = content.replace(/\\n/g, '\n');
                            content = content.replace(/^#+\s+/gm, ''); // Remove markdown headers
                            return content;
                          }
                          return typeof item === 'string' ? item : JSON.stringify(item);
                        }).join('\n\n');
                      }
                      // Handle parsed object
                      else if (parsed.title && parsed.content) {
                        // Just use content
                        let content = parsed.content;
                        content = content.replace(/\\n/g, '\n');
                        content = content.replace(/^#+\s+/gm, '');
                        formattedResult = content;
                      }
                      else {
                        formattedResult = invocation.result;
                      }
                    } catch (e) {
                      // Not JSON, use as is
                      formattedResult = invocation.result;
                    }
                  } else {
                    formattedResult = invocation.result;
                  }
                } else if (Array.isArray(invocation.result)) {
                  // For array results (like library lists or search results)
                  // Limit to first 3 items for mobile display
                  const items = invocation.result.slice(0, 3);
                  formattedResult = items.map((item: any) => {
                    let text = '';
                    
                    if (typeof item === 'string') {
                      text = item;
                    } else if (typeof item === 'object') {
                      // Extract content (skip title as it's usually redundant)
                      if (item.title && item.content) {
                        // Only use content, not title (title often repeats the question)
                        let content = item.content;
                        // Clean up the content
                        content = content.replace(/\\n/g, '\n');
                        content = content.replace(/^#+\s*/gm, ''); // Remove markdown headers
                        content = content.replace(/\*\*/g, ''); // Remove bold markers
                        
                        // Just return the clean content
                        text = content;
                      } else {
                        text = JSON.stringify(item, null, 2);
                      }
                    } else {
                      text = String(item);
                    }
                    
                    // Final cleanup
                    text = text.replace(/\\n/g, '\n');
                    text = text.substring(0, 500);
                    return text + (text.length >= 500 ? '...\n\n[Content truncated]' : '');
                  }).join('\n\n---\n\n');
                  
                  if (invocation.result.length > 3) {
                    formattedResult += `\n\n[Showing 3 of ${invocation.result.length} results]`;
                  }
                } else if (invocation.result.content) {
                  // For results with content field (like documentation)
                  if (Array.isArray(invocation.result.content)) {
                    // Limit array content to first 3 items
                    const items = invocation.result.content.slice(0, 3);
                    formattedResult = items.map((item: any) => {
                      let text = '';
                      
                      // CRITICAL: Handle MCP server response format
                      // The item might have a 'text' field that contains the actual JSON string
                      if (item.type === 'text' && item.text) {
                        // The text field contains the JSON string
                        const jsonString = item.text;
                        console.log('[MCP] Processing text field:', jsonString.substring(0, 100));
                        
                        // Parse the JSON string
                        if (jsonString.startsWith('[{') || jsonString.startsWith('{')) {
                          try {
                            const parsed = JSON.parse(jsonString);
                            if (Array.isArray(parsed) && parsed[0]?.title && parsed[0]?.content) {
                              // Just get the content, skip the title
                              text = parsed[0].content.replace(/\\n/g, '\n').replace(/^#+\s+/gm, '');
                            } else if (parsed.title && parsed.content) {
                              text = parsed.content.replace(/\\n/g, '\n').replace(/^#+\s+/gm, '');
                            } else {
                              text = jsonString;
                            }
                          } catch (e) {
                            console.error('[MCP] Failed to parse text field JSON:', e);
                            text = jsonString;
                          }
                        } else {
                          text = jsonString;
                        }
                      }
                      // Handle different content formats from MCP servers
                      else if (typeof item === 'string') {
                        text = item;
                        // Try to parse if it's a JSON string
                        if (text.startsWith('[{') || text.startsWith('{')) {
                          try {
                            const parsed = JSON.parse(text);
                            if (Array.isArray(parsed) && parsed[0]?.title && parsed[0]?.content) {
                              // It's an array of results, take the first one's content only
                              const first = parsed[0];
                              text = first.content;
                            } else if (parsed.title && parsed.content) {
                              // Just use content, not title
                              text = parsed.content;
                            }
                          } catch (e) {
                            // Keep as string if parsing fails
                          }
                        }
                      } else if (item.text) {
                        text = item.text;
                      } else if (item.title && item.content) {
                        // Microsoft Docs format - only show content, not title
                        // The title is usually just a repeat of the question
                        text = item.content;
                      } else {
                        text = JSON.stringify(item);
                      }
                      
                      // Critical: Replace literal \n with actual line breaks
                      text = text.replace(/\\n/g, '\n');
                      // Remove excess quotes that might wrap the content
                      text = text.replace(/^["']|["']$/g, '');
                      // Remove markdown headers for cleaner display
                      text = text.replace(/^#+\s+/gm, '');
                      
                      // If it still looks like escaped JSON, try to parse it
                      if (text.includes('{"title":') || text.includes('"content":')) {
                        try {
                          const parsed = JSON.parse(text);
                          if (parsed.title && parsed.content) {
                            // Just use content, skip title for cleaner output
                            text = parsed.content.replace(/\\n/g, '\n');
                          } else if (parsed.content) {
                            text = parsed.content.replace(/\\n/g, '\n');
                          }
                        } catch (e) {
                          // If parsing fails, continue with text as is
                        }
                      }
                      
                      // Truncate for mobile display
                      return text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
                    }).join('\n\n---\n\n');
                    
                    if (invocation.result.content.length > 3) {
                      formattedResult += `\n\n[Showing 3 of ${invocation.result.content.length} sections]`;
                    }
                  } else {
                    // Single content - clean up and truncate for mobile
                    let text = String(invocation.result.content);
                    
                    // Critical: Replace literal \n with actual line breaks
                    text = text.replace(/\\n/g, '\n');
                    // Remove excess quotes
                    text = text.replace(/^["']|["']$/g, '');
                    // Clean up headers
                    text = text.replace(/\\n##/g, '\n\n## ');
                    text = text.replace(/\\n#/g, '\n\n# ');
                    
                    // If it looks like JSON with title/content, parse it
                    if (text.includes('{"title":') || text.includes('"content":')) {
                      try {
                        const parsed = JSON.parse(text);
                        if (parsed.title && parsed.content) {
                          text = `# ${parsed.title}\n\n${parsed.content.replace(/\\n/g, '\n')}`;
                        } else if (parsed.content) {
                          text = parsed.content.replace(/\\n/g, '\n');
                        }
                      } catch (e) {
                        // Continue with text as is
                      }
                    }
                    
                    formattedResult = text.substring(0, 3000);
                    if (text.length > 3000) {
                      formattedResult += '\n\n[Content truncated for mobile display]';
                    }
                  }
                } else {
                  formattedResult = JSON.stringify(invocation.result, null, 2).substring(0, 1000);
                }
                
                toolResults.push(formattedResult);
              } else if (invocation.status === 'error') {
                toolResults.push(`Error: ${invocation.error}`);
              }
            } catch (error) {
              console.error('Tool invocation failed:', error);
              toolResults.push(`Failed to invoke ${call.toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
          
          // Now show the complete response with tool results
          if (toolResults.length > 0) {
            console.log('[MCP] Tool results obtained:', toolResults.length, 'results');
            
            // Safe preview logging
            try {
              const preview = String(toolResults[0]).substring(0, 200);
              console.log('[MCP] First result preview:', preview);
            } catch (e) {
              console.log('[MCP] Could not preview result:', e);
            }
            
            // Build the final result message - just show the content, no header
            const fullResult = toolResults.join('\n\n');
            
            // CRITICAL: Reset the isProcessingToolCall flag so output isn't suppressed
            isProcessingToolCall = false;
            
            // Update accumulated text with the full result
            accumulatedText = fullResult;
            
            // IMPORTANT: Show the results to the user via onProgress
            // This is critical when streaming was suppressed
            onProgress(fullResult);
            
            console.log('[MCP] Showed results to user via onProgress');
            console.log('[MCP] Full result length:', fullResult.length);
          } else {
            console.log('[MCP] No tool results obtained');
            // Reset flag
            isProcessingToolCall = false;
            // If no results, ensure we show something
            accumulatedText = 'Unable to retrieve tool results.';
            onProgress(accumulatedText);
          }
        } else {
          // Model tried to call a tool but it wasn't recognized
          console.error('[MCP] Model attempted tool call but no valid tools were extracted');
          // Reset flag so error message shows
          isProcessingToolCall = false;
          onProgress('\n❌ Error: The tool call could not be processed. The tool may not exist or the format was incorrect.\n');
          
          // Show what the model tried to call
          const codeBlockMatch = accumulatedText.match(/```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/);
          if (codeBlockMatch) {
            console.error('[MCP] Failed tool call attempt (code block):', codeBlockMatch[1]);
          } else {
            // Check for bare JSON
            const jsonMatch = accumulatedText.match(/\{[^{}]*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^{}]*\}\s*\}/);
            if (jsonMatch) {
              console.error('[MCP] Failed tool call attempt (bare JSON):', jsonMatch[0]);
            }
          }
        }
      }
    }
    
    // Call the original complete callback
    onComplete(metrics, model, accumulatedText);
  };
  
  // Use the base Llama completion with our wrapped callbacks
  return streamLlamaCompletion(
    lm,
    messages,  // Use original messages, no pre-fetching
    model,
    wrappedOnProgress,
    wrappedOnComplete,
    streaming,
    maxTokens,
    isReasoningEnabled,
    voiceMode,
    enhancedSystemPrompt
  );
}