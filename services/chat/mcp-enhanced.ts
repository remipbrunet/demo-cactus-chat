// MCP-Enhanced Chat Service
import { Message } from '@/components/ui/chat/ChatMessage';
import { Model } from '../models';
import { ModelMetrics } from '@/utils/modelMetrics';
import { mcpClient } from '../mcp/client';
import { MCPToolInvocation } from '../mcp/types';
import { sendChatMessage, ChatProgressCallback, ChatCompleteCallback, ChatOptions } from './_chat';

interface MCPEnhancedMessage extends Message {
  toolInvocations?: MCPToolInvocation[];
  reasoning?: string;
}

interface ToolCall {
  serverId: string;
  toolName: string;
  arguments: any;
}

/**
 * Detects if the model response contains tool calls
 * Qwen models typically use a format like:
 * <tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
 */
function extractToolCalls(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Pattern 1: XML-style tool calls (common in instruction-tuned models)
  const xmlPattern = /<tool_call>(.*?)<\/tool_call>/gs;
  const xmlMatches = text.matchAll(xmlPattern);
  
  for (const match of xmlMatches) {
    try {
      const toolData = JSON.parse(match[1]);
      
      // Try to match the tool to a connected server
      const servers = mcpClient.getConnectedServers();
      for (const server of servers) {
        const tool = server.tools?.find(t => t.name === toolData.name);
        if (tool) {
          toolCalls.push({
            serverId: server.id,
            toolName: toolData.name,
            arguments: toolData.arguments || {},
          });
          break;
        }
      }
    } catch (error) {
      console.error('Failed to parse tool call:', error);
    }
  }
  
  // Pattern 2: Function calling format (OpenAI-style)
  const functionPattern = /```function\n(.*?)\n```/gs;
  const functionMatches = text.matchAll(functionPattern);
  
  for (const match of functionMatches) {
    try {
      const toolData = JSON.parse(match[1]);
      
      // Try to match the tool to a connected server
      const servers = mcpClient.getConnectedServers();
      for (const server of servers) {
        const tool = server.tools?.find(t => t.name === toolData.function);
        if (tool) {
          toolCalls.push({
            serverId: server.id,
            toolName: toolData.function,
            arguments: toolData.arguments || {},
          });
          break;
        }
      }
    } catch (error) {
      console.error('Failed to parse function call:', error);
    }
  }
  
  return toolCalls;
}

/**
 * Formats available tools for inclusion in the system prompt
 */
function formatToolsForPrompt(): string {
  const servers = mcpClient.getConnectedServers();
  if (servers.length === 0) return '';
  
  let toolsDescription = '\n\n## Available Tools\n\n';
  toolsDescription += 'You have access to the following tools. When you need to use a tool, format your response as:\n';
  toolsDescription += '<tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>\n\n';
  
  for (const server of servers) {
    if (server.tools && server.tools.length > 0) {
      toolsDescription += `### ${server.name}\n`;
      for (const tool of server.tools) {
        toolsDescription += `- **${tool.name}**: ${tool.description || 'No description'}\n`;
        if (tool.inputSchema?.properties) {
          toolsDescription += '  Parameters:\n';
          for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
            const required = tool.inputSchema.required?.includes(param) ? ' (required)' : ' (optional)';
            toolsDescription += `    - ${param}${required}: ${(schema as any).description || (schema as any).type}\n`;
          }
        }
      }
      toolsDescription += '\n';
    }
  }
  
  return toolsDescription;
}

/**
 * Enhanced chat service with MCP tool support
 */
export async function sendMCPEnhancedMessage(
  messages: Message[],
  model: Model,
  onProgress: ChatProgressCallback,
  onComplete: ChatCompleteCallback,
  onToolInvocation?: (invocation: MCPToolInvocation) => void,
  options: ChatOptions = { streaming: true, voiceMode: false },
  maxTokens: number = 2048,
  systemPrompt?: string
): Promise<void> {
  // Check if we have any connected MCP servers
  const connectedServers = mcpClient.getConnectedServers();
  const hasTools = connectedServers.some(s => s.tools && s.tools.length > 0);
  
  // Prepare messages with tool information if available
  let enhancedMessages = [...messages];
  if (hasTools && systemPrompt) {
    // Add tool information to the system prompt
    const toolsPrompt = formatToolsForPrompt();
    const enhancedSystemPrompt = systemPrompt + toolsPrompt;
    
    // Update or add system message
    const systemMessageIndex = enhancedMessages.findIndex(m => m.role === 'system');
    if (systemMessageIndex >= 0) {
      enhancedMessages[systemMessageIndex] = {
        ...enhancedMessages[systemMessageIndex],
        text: enhancedSystemPrompt,
      };
    } else {
      enhancedMessages.unshift({
        id: `system-${Date.now()}`,
        text: enhancedSystemPrompt,
        isUser: false,
        role: 'system',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  let accumulatedText = '';
  const toolInvocations: MCPToolInvocation[] = [];
  
  // Wrap the progress callback to detect tool calls
  const wrappedOnProgress: ChatProgressCallback = (text: string) => {
    accumulatedText += text;
    onProgress(text);
  };
  
  // Wrap the complete callback to handle tool invocations
  const wrappedOnComplete: ChatCompleteCallback = async (metrics, model, completeMessage) => {
    // Check for tool calls in the accumulated text
    const toolCalls = extractToolCalls(accumulatedText);
    
    if (toolCalls.length > 0) {
      // Execute tool calls
      for (const call of toolCalls) {
        try {
          const invocation = await mcpClient.callTool(
            call.serverId,
            call.toolName,
            call.arguments
          );
          
          toolInvocations.push(invocation);
          onToolInvocation?.(invocation);
          
          // Format the tool result for display
          if (invocation.status === 'completed' && invocation.result) {
            const resultText = `\n\n**Tool Result (${call.toolName}):**\n${
              typeof invocation.result === 'string' 
                ? invocation.result 
                : JSON.stringify(invocation.result, null, 2)
            }\n`;
            
            onProgress(resultText);
            accumulatedText += resultText;
          }
        } catch (error) {
          console.error('Tool invocation failed:', error);
          const errorText = `\n\n**Tool Error (${call.toolName}):** ${error instanceof Error ? error.message : 'Unknown error'}\n`;
          onProgress(errorText);
          accumulatedText += errorText;
        }
      }
    }
    
    // Call the original complete callback with the full message including tool results
    onComplete(metrics, model, accumulatedText);
  };
  
  // Send the message using the base chat service
  return sendChatMessage(
    enhancedMessages,
    model,
    wrappedOnProgress,
    wrappedOnComplete,
    options,
    maxTokens
  );
}

/**
 * Checks if a model supports tool calling
 */
export function modelSupportsTools(model: Model): boolean {
  // Qwen 2.5 models (0.5B and above) support tool calling
  if (model.name.toLowerCase().includes('qwen') && model.name.includes('2.5')) {
    return true;
  }
  
  // Add other models that support tool calling here
  // For example: Llama 3.2, Mistral with function calling, etc.
  
  return false;
}