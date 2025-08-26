/**
 * MCP-CactusAgent Integration Layer
 * Connects MCP protocol to CactusAgent tool system
 */

import { CactusAgent } from 'cactus-react-native';
import { 
  MCPService, 
  MCPTool, 
  MCPToolResult, 
  MCPResource, 
  MCPResourceContent,
  MCPConnectionState 
} from '../mcp';
import { RAGService } from '../rag';
import { Message } from '@/components/ui/chat/ChatMessage';
import { Model } from '../models';
import { ModelMetrics } from '@/utils/modelMetrics';

export interface MCPChatOptions {
  enableRAG?: boolean;
  maxContextResources?: number;
  resourceQuery?: string;
  serverFilters?: string[];
  toolFilters?: string[];
  maxTokens?: number;
  includeHistory?: boolean;
  enableReranking?: boolean;
}

export interface MCPEnhancedResponse {
  text: string;
  toolCalls: Array<{
    toolName: string;
    serverId: string;
    arguments: Record<string, any>;
    result: MCPToolResult;
  }>;
  resourcesUsed: Array<{
    uri: string;
    serverId: string;
    content: string;
  }>;
  metadata: {
    totalToolCalls: number;
    totalResourcesQueried: number;
    enhancementTime: number;
  };
}

/**
 * MCP-Enhanced Chat Service
 * Integrates MCP capabilities with CactusAgent
 */
export class MCPChatService {
  private mcpService: MCPService;
  private ragService?: RAGService;
  private toolRegistry: Map<string, {
    tool: MCPTool;
    serverId: string;
    serverName: string;
  }> = new Map();

  constructor(mcpService: MCPService, ragService?: RAGService) {
    this.mcpService = mcpService;
    this.ragService = ragService;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Update tool registry when tools change
    this.mcpService.on('tool-update', () => {
      this.refreshToolRegistry();
    });

    // Log MCP events for debugging
    this.mcpService.on('log', ({ serverId, entry }) => {
      console.log(`[MCP ${serverId}] ${entry.level}: ${entry.message}`, entry.data);
    });
  }

  /**
   * Initialize MCP integration and register tools with CactusAgent
   */
  async initialize(): Promise<void> {
    await this.mcpService.initialize();
    await this.refreshToolRegistry();
  }

  /**
   * Refresh the tool registry from all connected MCP servers
   */
  private async refreshToolRegistry(): Promise<void> {
    try {
      const availableTools = await this.mcpService.getAvailableTools();
      this.toolRegistry.clear();
      
      for (const tool of availableTools) {
        this.toolRegistry.set(tool.name, {
          tool,
          serverId: tool.serverId,
          serverName: tool.serverName,
        });
      }

      console.log(`MCP Tool Registry updated with ${this.toolRegistry.size} tools`);
    } catch (error) {
      console.error('Failed to refresh MCP tool registry:', error);
    }
  }

  /**
   * Register MCP tools with a CactusAgent instance
   */
  async registerMCPToolsWithAgent(agent: CactusAgent, options: { 
    serverFilters?: string[];
    toolFilters?: string[];
  } = {}): Promise<void> {
    const { serverFilters, toolFilters } = options;

    for (const [toolName, toolInfo] of this.toolRegistry) {
      // Apply filters
      if (serverFilters && !serverFilters.includes(toolInfo.serverId)) {
        continue;
      }
      if (toolFilters && !toolFilters.includes(toolName)) {
        continue;
      }

      // Create wrapper function for MCP tool
      const mcpToolWrapper = async (...args: any[]) => {
        try {
          // Convert args to tool arguments based on tool schema
          const toolArgs = this.convertArgsToToolArguments(toolInfo.tool, args);
          const result = await this.mcpService.callTool(toolInfo.serverId, toolName, toolArgs);
          
          // Convert MCP result to agent-friendly format
          return this.convertMCPResultToAgentResult(result);
        } catch (error) {
          console.error(`MCP tool execution failed (${toolName}):`, error);
          throw error;
        }
      };

      // Register with CactusAgent
      agent.addTool(
        mcpToolWrapper,
        toolInfo.tool.description || `MCP tool: ${toolName}`,
        this.convertMCPSchemaToAgentSchema(toolInfo.tool.inputSchema)
      );

      console.log(`Registered MCP tool: ${toolName} from ${toolInfo.serverName}`);
    }
  }

  /**
   * Enhanced chat completion with RAG and MCP tools integration
   */
  async enhancedChatCompletion(
    agent: CactusAgent,
    messages: Message[],
    model: Model,
    onProgress: (text: string) => void,
    onComplete: (metrics: ModelMetrics, model: Model, response: MCPEnhancedResponse) => void,
    options: MCPChatOptions = {},
    maxTokens: number,
    conversationId: string,
    systemPrompt?: string
  ): Promise<void> {
    const startTime = performance.now();
    let enhancedResponse: MCPEnhancedResponse = {
      text: '',
      toolCalls: [],
      resourcesUsed: [],
      metadata: {
        totalToolCalls: 0,
        totalResourcesQueried: 0,
        enhancementTime: 0,
      },
    };

    try {
      // Step 1: Enhanced RAG Processing (if RAG service available and enabled)
      let contextEnhancedPrompt = systemPrompt || '';
      if (options.enableRAG && this.ragService && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.isUser) {
          console.log('Performing RAG enhancement for query:', lastMessage.text);
          
          try {
            const ragResult = await this.ragService.enhancedQuery(
              lastMessage.text,
              conversationId,
              messages,
              {
                enableRAG: true,
                serverFilters: options.serverFilters,
                maxResults: options.maxContextResources || 5,
                includeHistory: options.includeHistory,
                maxTokens: options.maxTokens,
                enableReranking: options.enableReranking,
              }
            );
            
            if (ragResult.metadata.ragEnabled) {
              contextEnhancedPrompt = ragResult.systemPrompt;
              enhancedResponse.metadata.totalResourcesQueried = ragResult.metadata.chunksUsed;
              
              // Convert RAG sources to resource format for compatibility
              enhancedResponse.resourcesUsed = ragResult.metadata.sources.map(source => ({
                uri: source,
                serverId: 'rag', // Placeholder
                content: `RAG context from ${source}`,
              }));
              
              console.log(`RAG enhancement complete: ${ragResult.metadata.chunksUsed} chunks, ${ragResult.metadata.tokensUsed} tokens`);
            }
          } catch (ragError) {
            console.warn('RAG enhancement failed, continuing without:', ragError);
          }
        }
      } else if (options.enableRAG && !this.ragService) {
        console.warn('RAG requested but RAG service not available');
      }

      // Step 2: Fallback to legacy RAG if RAG service not available
      if (!this.ragService && options.enableRAG && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.isUser) {
          const legacyRAGContext = await this.performLegacyRAGLookup(
            lastMessage.text, 
            options
          );
          
          if (legacyRAGContext.length > 0) {
            contextEnhancedPrompt += this.buildRAGContext(legacyRAGContext);
            enhancedResponse.resourcesUsed = legacyRAGContext;
            enhancedResponse.metadata.totalResourcesQueried = legacyRAGContext.length;
          }
        }
      }

      // Step 3: Register MCP tools with agent
      await this.registerMCPToolsWithAgent(agent, {
        serverFilters: options.serverFilters,
        toolFilters: options.toolFilters,
      });

      // Step 4: Prepare messages with enhanced context
      const formattedMessages = [
        {
          role: 'system' as const,
          content: contextEnhancedPrompt,
        },
        ...messages.map(msg => ({
          role: msg.isUser ? 'user' as const : 'assistant' as const,
          content: msg.text,
        })),
      ];

      // Step 5: Execute completion with tools
      let responseText = '';
      let firstTokenTime: number | null = null;
      const modelStartTime = performance.now();

      let modelMetrics: ModelMetrics = {
        timeToFirstToken: 0,
        completionTokens: 0,
        tokensPerSecond: 0,
      };

      const result = await agent.completionWithTools(
        formattedMessages,
        {
          n_predict: maxTokens,
          temperature: 0.7,
        },
        (data: any) => {
          if (data.token) {
            if (!firstTokenTime) {
              firstTokenTime = performance.now();
              modelMetrics.timeToFirstToken = firstTokenTime - modelStartTime;
            }
            responseText += data.token;
            enhancedResponse.text = responseText;
            onProgress(responseText);
          }
        }
      );

      // Step 6: Process tool calls if any
      if (result.tool_calls && result.tool_calls.length > 0) {
        for (const toolCall of result.tool_calls) {
          const toolInfo = this.toolRegistry.get(toolCall.name);
          if (toolInfo) {
            enhancedResponse.toolCalls.push({
              toolName: toolCall.name,
              serverId: toolInfo.serverId,
              arguments: toolCall.arguments,
              result: toolCall.result,
            });
          }
        }
        enhancedResponse.metadata.totalToolCalls = result.tool_calls.length;
      }

      // Step 7: Finalize metrics
      modelMetrics.completionTokens = result.timings?.predicted_n || 0;
      modelMetrics.tokensPerSecond = result.timings?.predicted_per_second || 0;
      enhancedResponse.metadata.enhancementTime = performance.now() - startTime;

      console.log(`MCP-enhanced completion: ${enhancedResponse.metadata.totalResourcesQueried} resources, ${enhancedResponse.metadata.totalToolCalls} tool calls in ${enhancedResponse.metadata.enhancementTime}ms`);

      onComplete(modelMetrics, model, enhancedResponse);
    } catch (error) {
      console.error('MCP-enhanced chat completion failed:', error);
      throw error;
    }
  }

  /**
   * Legacy RAG lookup for fallback (when RAG service not available)
   */
  private async performLegacyRAGLookup(
    query: string, 
    options: MCPChatOptions
  ): Promise<Array<{ uri: string; serverId: string; content: string }>> {
    try {
      const availableResources = await this.mcpService.getAvailableResources();
      const relevantResources: Array<{ uri: string; serverId: string; content: string }> = [];

      // Apply server filters
      const filteredResources = options.serverFilters 
        ? availableResources.filter(r => options.serverFilters!.includes(r.serverId))
        : availableResources;

      // Simple relevance scoring (in production, use vector embeddings)
      const queryTerms = query.toLowerCase().split(/\s+/);
      const scoredResources = filteredResources
        .map(resource => {
          const nameScore = this.calculateRelevanceScore(resource.name.toLowerCase(), queryTerms);
          const descScore = this.calculateRelevanceScore(resource.description?.toLowerCase() || '', queryTerms);
          return {
            resource,
            score: Math.max(nameScore, descScore),
          };
        })
        .filter(item => item.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, options.maxContextResources || 5);

      // Fetch content for relevant resources
      for (const { resource } of scoredResources) {
        try {
          const content = await this.mcpService.readResource(resource.serverId, resource.uri);
          if (content.text) {
            relevantResources.push({
              uri: resource.uri,
              serverId: resource.serverId,
              content: content.text,
            });
          }
        } catch (error) {
          console.warn(`Failed to read resource ${resource.uri}:`, error);
        }
      }

      return relevantResources;
    } catch (error) {
      console.error('RAG lookup failed:', error);
      return [];
    }
  }

  /**
   * Build RAG context prompt from retrieved resources
   */
  private buildRAGContext(resources: Array<{ uri: string; serverId: string; content: string }>): string {
    if (resources.length === 0) {
      return '';
    }

    let context = '\n\n--- CONTEXT FROM MCP RESOURCES ---\n';
    for (const resource of resources) {
      context += `\nResource: ${resource.uri}\n`;
      context += `Content: ${resource.content.substring(0, 1000)}...\n`;
    }
    context += '\n--- END CONTEXT ---\n\n';
    context += 'Use the above context to provide more accurate and relevant responses. ';
    context += 'If the context is relevant to the user\'s question, reference it appropriately.\n';

    return context;
  }

  /**
   * Simple relevance scoring for RAG
   */
  private calculateRelevanceScore(text: string, queryTerms: string[]): number {
    if (!text) return 0;
    
    let score = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        score += 1;
      }
    }
    
    return score / queryTerms.length;
  }

  /**
   * Convert function arguments to MCP tool arguments
   */
  private convertArgsToToolArguments(tool: MCPTool, args: any[]): Record<string, any> {
    const toolArgs: Record<string, any> = {};
    const properties = Object.keys(tool.inputSchema.properties);
    
    for (let i = 0; i < Math.min(args.length, properties.length); i++) {
      toolArgs[properties[i]] = args[i];
    }
    
    return toolArgs;
  }

  /**
   * Convert MCP result to agent-friendly result
   */
  private convertMCPResultToAgentResult(result: MCPToolResult): any {
    if (result.isError) {
      throw new Error(`Tool execution error: ${JSON.stringify(result.content)}`);
    }

    // Extract text content
    const textContent = result.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return textContent || JSON.stringify(result.content);
  }

  /**
   * Convert MCP tool schema to CactusAgent schema
   */
  private convertMCPSchemaToAgentSchema(inputSchema: MCPTool['inputSchema']): Record<string, any> {
    const agentSchema: Record<string, any> = {};
    
    for (const [paramName, param] of Object.entries(inputSchema.properties)) {
      agentSchema[paramName] = {
        type: param.type,
        description: param.description || '',
        required: inputSchema.required?.includes(paramName) || false,
      };
    }
    
    return agentSchema;
  }

  /**
   * Get connection status for all MCP servers
   */
  getConnectionStatus(): Array<{
    serverId: string;
    serverName: string;
    state: MCPConnectionState;
    isReady: boolean;
    toolCount: number;
    resourceCount: number;
  }> {
    const status = this.mcpService.getConnectionStatus();
    return status.map(server => {
      const toolCount = Array.from(this.toolRegistry.values())
        .filter(t => t.serverId === server.serverId).length;
      
      return {
        ...server,
        toolCount,
        resourceCount: 0, // Would need to cache this
      };
    });
  }

  /**
   * Get available tools grouped by server
   */
  getAvailableToolsByServer(): Record<string, Array<{ tool: MCPTool; serverName: string }>> {
    const toolsByServer: Record<string, Array<{ tool: MCPTool; serverName: string }>> = {};
    
    for (const [toolName, toolInfo] of this.toolRegistry) {
      if (!toolsByServer[toolInfo.serverId]) {
        toolsByServer[toolInfo.serverId] = [];
      }
      
      toolsByServer[toolInfo.serverId].push({
        tool: toolInfo.tool,
        serverName: toolInfo.serverName,
      });
    }
    
    return toolsByServer;
  }

  /**
   * Find and call a tool by name (searches all servers)
   */
  async findAndCallTool(toolName: string, arguments_: Record<string, any>): Promise<MCPToolResult & { serverId: string }> {
    const toolInfo = this.toolRegistry.get(toolName);
    
    if (!toolInfo) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const result = await this.mcpService.callTool(toolInfo.serverId, toolName, arguments_);
    return { ...result, serverId: toolInfo.serverId };
  }

  /**
   * Shutdown MCP integration
   */
  async shutdown(): Promise<void> {
    await this.mcpService.shutdown();
    this.toolRegistry.clear();
  }
}