/**
 * Context Management and RAG Orchestration
 * Manages conversation history, retrieved context, and prompt augmentation
 */

// Simple EventEmitter implementation for React Native compatibility
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  removeListener(event: string, callback: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}
import {
  RAGContext,
  DocumentChunk,
  ContextBuilder,
  RAGConfig,
  RAGError,
  RAGMetrics,
} from './types';
import { Message } from '@/components/ui/chat/ChatMessage';
import { TextPreprocessor } from './processing';

interface ConversationContext {
  id: string;
  messages: Message[];
  currentContext?: RAGContext;
  contextHistory: Array<{
    query: string;
    context: RAGContext;
    timestamp: number;
  }>;
  metadata: {
    created: number;
    lastUpdated: number;
    totalQueries: number;
  };
}

/**
 * Intelligent context builder with compression and ranking
 */
export class SmartContextBuilder implements ContextBuilder {
  private config: RAGConfig;

  constructor(config: RAGConfig) {
    this.config = config;
  }

  /**
   * Build RAG context from query and retrieved chunks
   */
  async build(
    query: string,
    chunks: DocumentChunk[],
    options: {
      maxTokens?: number;
      includeMetadata?: boolean;
      conversationHistory?: Message[];
      preserveOrder?: boolean;
    } = {}
  ): Promise<RAGContext> {
    try {
      const maxTokens = options.maxTokens || this.config.retrieval.maxContextLength;
      
      // Rank chunks if not preserving original order
      let rankedChunks = chunks;
      if (!options.preserveOrder && chunks.length > 1) {
        rankedChunks = await this.rank(chunks, query);
      }

      // Build initial context
      let contextChunks = rankedChunks;
      let prompt = this.buildPrompt(query, contextChunks, {
        includeMetadata: options.includeMetadata,
        conversationHistory: options.conversationHistory,
      });

      // Compress if necessary
      let totalTokens = TextPreprocessor.estimateTokens(prompt);
      if (totalTokens > maxTokens && contextChunks.length > 1) {
        const compressed = await this.compress({
          chunks: contextChunks,
          query,
          prompt,
          metadata: {
            totalTokens,
            sourceCount: new Set(contextChunks.map(c => c.metadata.sourceUri)).size,
            relevanceRange: this.getRelevanceRange(contextChunks),
            generatedAt: Date.now(),
          },
        }, maxTokens);
        
        return compressed;
      }

      // Build final context
      const context: RAGContext = {
        chunks: contextChunks,
        query,
        prompt,
        metadata: {
          totalTokens,
          sourceCount: new Set(contextChunks.map(c => c.metadata.sourceUri)).size,
          relevanceRange: this.getRelevanceRange(contextChunks),
          generatedAt: Date.now(),
        },
      };

      return context;
      
    } catch (error) {
      throw new RAGError(
        `Context building failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTEXT_BUILD_ERROR',
        { query, chunkCount: chunks.length }
      );
    }
  }

  /**
   * Compress context to fit within token limits
   */
  async compress(context: RAGContext, maxTokens: number): Promise<RAGContext> {
    try {
      let compressedChunks = [...context.chunks];
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const testPrompt = this.buildPrompt(context.query, compressedChunks);
        const estimatedTokens = TextPreprocessor.estimateTokens(testPrompt);
        
        if (estimatedTokens <= maxTokens) {
          break;
        }

        // Remove least relevant chunks or truncate content
        if (compressedChunks.length > 1) {
          // Remove the chunk with lowest relevance score
          compressedChunks.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          compressedChunks = compressedChunks.slice(0, -1);
        } else if (compressedChunks.length === 1) {
          // Truncate the remaining chunk
          const chunk = compressedChunks[0];
          const targetLength = Math.floor(chunk.content.length * (maxTokens / estimatedTokens));
          compressedChunks[0] = {
            ...chunk,
            content: this.truncateContent(chunk.content, targetLength),
          };
        } else {
          break;
        }

        attempts++;
      }

      const finalPrompt = this.buildPrompt(context.query, compressedChunks);
      const finalTokens = TextPreprocessor.estimateTokens(finalPrompt);

      return {
        ...context,
        chunks: compressedChunks,
        prompt: finalPrompt,
        metadata: {
          ...context.metadata,
          totalTokens: finalTokens,
          sourceCount: new Set(compressedChunks.map(c => c.metadata.sourceUri)).size,
          relevanceRange: this.getRelevanceRange(compressedChunks),
        },
      };
      
    } catch (error) {
      throw new RAGError(
        `Context compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTEXT_COMPRESSION_ERROR',
        { originalTokens: context.metadata.totalTokens, targetTokens: maxTokens }
      );
    }
  }

  /**
   * Rank chunks by relevance to query
   */
  async rank(chunks: DocumentChunk[], query: string): Promise<DocumentChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }

    try {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      
      return chunks.map(chunk => {
        let score = chunk.relevanceScore || 0;
        
        // Text-based relevance scoring
        const content = chunk.content.toLowerCase();
        
        // Exact phrase matching
        if (content.includes(query.toLowerCase())) {
          score += 0.3;
        }
        
        // Term frequency scoring
        const termMatches = queryTerms.filter(term => content.includes(term)).length;
        score += (termMatches / queryTerms.length) * 0.2;
        
        // Position-based scoring (earlier mentions are more important)
        for (const term of queryTerms) {
          const index = content.indexOf(term);
          if (index !== -1) {
            const positionScore = Math.max(0, 0.1 * (1 - index / content.length));
            score += positionScore;
          }
        }
        
        // Metadata-based scoring
        if (chunk.metadata.title) {
          const titleContent = chunk.metadata.title.toLowerCase();
          const titleMatches = queryTerms.filter(term => titleContent.includes(term)).length;
          score += (titleMatches / queryTerms.length) * 0.15;
        }
        
        // Tag-based scoring
        if (chunk.metadata.tags && chunk.metadata.tags.length > 0) {
          const tagMatches = queryTerms.filter(term => 
            chunk.metadata.tags!.some(tag => tag.includes(term))
          ).length;
          score += (tagMatches / queryTerms.length) * 0.1;
        }
        
        // Recency scoring
        const age = Date.now() - chunk.metadata.created;
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const recencyScore = Math.max(0, 0.05 * (1 - age / maxAge));
        score += recencyScore;
        
        return { ...chunk, relevanceScore: score };
      }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
    } catch (error) {
      console.warn('Chunk ranking failed, returning original order:', error);
      return chunks;
    }
  }

  /**
   * Build the final prompt with context
   */
  private buildPrompt(
    query: string,
    chunks: DocumentChunk[],
    options: {
      includeMetadata?: boolean;
      conversationHistory?: Message[];
    } = {}
  ): string {
    let prompt = '';

    // Add conversation history if provided
    if (options.conversationHistory && options.conversationHistory.length > 0) {
      prompt += '=== CONVERSATION HISTORY ===\n';
      const recentMessages = options.conversationHistory.slice(-6); // Last 6 messages
      
      for (const message of recentMessages) {
        const role = message.isUser ? 'User' : 'Assistant';
        prompt += `${role}: ${message.text.substring(0, 500)}\n\n`;
      }
      prompt += '=== END CONVERSATION HISTORY ===\n\n';
    }

    // Add retrieved context
    if (chunks.length > 0) {
      prompt += '=== RELEVANT CONTEXT ===\n\n';
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        prompt += `[Source ${i + 1}`;
        if (options.includeMetadata) {
          prompt += ` - ${this.extractSourceName(chunk.metadata.sourceUri)}`;
          if (chunk.relevanceScore) {
            prompt += ` (relevance: ${chunk.relevanceScore.toFixed(2)})`;
          }
        }
        prompt += ']\n';
        
        prompt += chunk.content;
        prompt += '\n\n';
        
        // Add section information if available
        if (chunk.metadata.section) {
          prompt += `(From section: ${chunk.metadata.section})\n\n`;
        }
      }
      
      prompt += '=== END CONTEXT ===\n\n';
    }

    // Add instruction
    prompt += 'Based on the above context and conversation history, please answer the following question. ';
    prompt += 'If the context contains relevant information, use it to provide a comprehensive answer. ';
    prompt += 'If the context is not relevant or sufficient, indicate this and provide the best answer you can based on your general knowledge.\n\n';
    prompt += `Question: ${query}`;

    return prompt;
  }

  private truncateContent(content: string, targetLength: number): string {
    if (content.length <= targetLength) {
      return content;
    }

    // Try to truncate at a sentence boundary
    const truncated = content.substring(0, targetLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > targetLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    // Try to truncate at a word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > targetLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  private extractSourceName(uri: string): string {
    // Extract a readable source name from URI
    try {
      if (uri.includes('/')) {
        const parts = uri.split('/');
        return parts[parts.length - 1] || parts[parts.length - 2] || uri;
      }
      return uri;
    } catch {
      return uri;
    }
  }

  private getRelevanceRange(chunks: DocumentChunk[]): [number, number] {
    if (chunks.length === 0) {
      return [0, 0];
    }

    const scores = chunks
      .map(c => c.relevanceScore || 0)
      .filter(s => s > 0);

    if (scores.length === 0) {
      return [0, 0];
    }

    return [Math.min(...scores), Math.max(...scores)];
  }
}

/**
 * Context manager for conversation-aware RAG
 */
export class RAGContextManager extends SimpleEventEmitter {
  private conversations: Map<string, ConversationContext> = new Map();
  private contextBuilder: SmartContextBuilder;
  private config: RAGConfig;
  private currentMetrics: RAGMetrics['context'];

  constructor(config: RAGConfig) {
    super();
    this.config = config;
    this.contextBuilder = new SmartContextBuilder(config);
    
    this.currentMetrics = {
      contextLength: 0,
      compressionRatio: 0,
      relevantChunks: 0,
      duplicatesFiltered: 0,
    };
  }

  /**
   * Create or update conversation context
   */
  async buildConversationContext(
    conversationId: string,
    query: string,
    retrievedChunks: DocumentChunk[],
    messages: Message[],
    options: {
      maxTokens?: number;
      includeHistory?: boolean;
      preserveChunkOrder?: boolean;
    } = {}
  ): Promise<RAGContext> {
    try {
      // Get or create conversation
      let conversation = this.conversations.get(conversationId);
      if (!conversation) {
        conversation = {
          id: conversationId,
          messages: [],
          contextHistory: [],
          metadata: {
            created: Date.now(),
            lastUpdated: Date.now(),
            totalQueries: 0,
          },
        };
        this.conversations.set(conversationId, conversation);
      }

      // Update conversation
      conversation.messages = messages;
      conversation.metadata.lastUpdated = Date.now();
      conversation.metadata.totalQueries++;

      // Build context with conversation awareness
      const contextOptions = {
        maxTokens: options.maxTokens || this.config.retrieval.maxContextLength,
        includeMetadata: true,
        conversationHistory: options.includeHistory ? messages : undefined,
        preserveOrder: options.preserveChunkOrder,
      };

      const ragContext = await this.contextBuilder.build(query, retrievedChunks, contextOptions);

      // Store context in conversation history
      conversation.currentContext = ragContext;
      conversation.contextHistory.push({
        query,
        context: ragContext,
        timestamp: Date.now(),
      });

      // Limit context history size
      if (conversation.contextHistory.length > 10) {
        conversation.contextHistory = conversation.contextHistory.slice(-10);
      }

      // Update metrics
      this.updateContextMetrics(ragContext, retrievedChunks.length);

      this.emit('context-update', {
        conversationId,
        context: ragContext,
        metrics: this.currentMetrics,
      });

      return ragContext;
      
    } catch (error) {
      throw new RAGError(
        `Conversation context building failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONVERSATION_CONTEXT_ERROR',
        { conversationId, query }
      );
    }
  }

  /**
   * Get conversation context history
   */
  getConversationHistory(conversationId: string): ConversationContext | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Clear conversation context
   */
  clearConversationContext(conversationId: string): void {
    this.conversations.delete(conversationId);
    console.log(`Cleared context for conversation ${conversationId}`);
  }

  /**
   * Get context recommendations for a query
   */
  async getContextRecommendations(
    conversationId: string,
    query: string
  ): Promise<{
    suggestedMaxTokens: number;
    shouldIncludeHistory: boolean;
    relevantPastQueries: string[];
  }> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return {
        suggestedMaxTokens: this.config.retrieval.maxContextLength,
        shouldIncludeHistory: false,
        relevantPastQueries: [],
      };
    }

    // Analyze query complexity
    const queryTokens = TextPreprocessor.estimateTokens(query);
    const isComplexQuery = queryTokens > 50 || query.includes('explain') || query.includes('analyze');
    
    // Check for follow-up questions
    const isFollowUp = this.isFollowUpQuestion(query, conversation.messages);
    
    // Find relevant past queries
    const relevantQueries = this.findRelevantPastQueries(query, conversation.contextHistory);
    
    return {
      suggestedMaxTokens: isComplexQuery 
        ? Math.min(this.config.retrieval.maxContextLength * 1.5, 4000)
        : this.config.retrieval.maxContextLength,
      shouldIncludeHistory: isFollowUp || relevantQueries.length > 0,
      relevantPastQueries: relevantQueries,
    };
  }

  private isFollowUpQuestion(query: string, messages: Message[]): boolean {
    if (messages.length === 0) {
      return false;
    }

    const followUpIndicators = [
      'more about', 'explain further', 'what about', 'how about',
      'can you', 'what is', 'tell me', 'also', 'additionally',
      'furthermore', 'moreover', 'in addition'
    ];

    const queryLower = query.toLowerCase();
    return followUpIndicators.some(indicator => queryLower.includes(indicator));
  }

  private findRelevantPastQueries(query: string, contextHistory: Array<{
    query: string;
    context: RAGContext;
    timestamp: number;
  }>): string[] {
    const queryTerms = new Set(
      query.toLowerCase().split(/\s+/).filter(t => t.length > 3)
    );

    const relevantQueries: Array<{ query: string; score: number }> = [];

    for (const historyItem of contextHistory) {
      const historyTerms = new Set(
        historyItem.query.toLowerCase().split(/\s+/).filter(t => t.length > 3)
      );

      // Calculate term overlap
      const intersection = new Set([...queryTerms].filter(t => historyTerms.has(t)));
      const union = new Set([...queryTerms, ...historyTerms]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.2) {
        relevantQueries.push({
          query: historyItem.query,
          score: similarity,
        });
      }
    }

    return relevantQueries
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.query);
  }

  private updateContextMetrics(ragContext: RAGContext, originalChunkCount: number): void {
    this.currentMetrics = {
      contextLength: ragContext.metadata.totalTokens,
      compressionRatio: ragContext.chunks.length < originalChunkCount 
        ? ragContext.chunks.length / originalChunkCount 
        : 1.0,
      relevantChunks: ragContext.chunks.length,
      duplicatesFiltered: originalChunkCount - ragContext.chunks.length,
    };
  }

  /**
   * Get current context metrics
   */
  getContextMetrics(): RAGMetrics['context'] {
    return { ...this.currentMetrics };
  }

  /**
   * Clear all conversation contexts
   */
  clearAllContexts(): void {
    this.conversations.clear();
    console.log('Cleared all conversation contexts');
  }

  /**
   * Get statistics about managed contexts
   */
  getStats(): {
    activeConversations: number;
    totalQueries: number;
    averageContextLength: number;
  } {
    const conversations = Array.from(this.conversations.values());
    
    return {
      activeConversations: conversations.length,
      totalQueries: conversations.reduce((sum, conv) => sum + conv.metadata.totalQueries, 0),
      averageContextLength: conversations.length > 0
        ? conversations.reduce((sum, conv) => 
            sum + (conv.currentContext?.metadata.totalTokens || 0), 0) / conversations.length
        : 0,
    };
  }
}