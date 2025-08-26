/**
 * Document Processing Pipeline
 * Handles text chunking, preprocessing, and document structure preservation
 */

import { DocumentProcessor, DocumentChunk, ProcessedDocument, ProcessingError, RAGConfig } from './types';
import { MCPResourceContent } from '../mcp/types';

/**
 * Text preprocessing utilities
 */
export class TextPreprocessor {
  /**
   * Clean and normalize text content
   */
  static cleanText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize unicode
      .normalize('NFKC')
      .trim();
  }

  /**
   * Extract metadata from text structure
   */
  static extractMetadata(text: string): {
    title?: string;
    sections: Array<{ title: string; start: number; end: number }>;
    tags: string[];
  } {
    const metadata = { sections: [] as Array<{ title: string; start: number; end: number }>, tags: [] as string[] };
    
    // Try to find title (first H1 or prominent line)
    const titleMatch = text.match(/^#\s+(.+)$/m) || text.match(/^(.{1,100})\n[=]{3,}/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Find section headers
    const sectionRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = sectionRegex.exec(text)) !== null) {
      metadata.sections.push({
        title: match[2].trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Extract tags from common formats
    const tagPatterns = [
      /#(\w+)/g,           // #hashtags
      /\[(\w+)\]/g,        // [tags]
      /tags?:\s*([^\n]+)/gi // tags: word, word
    ];

    for (const pattern of tagPatterns) {
      let tagMatch;
      while ((tagMatch = pattern.exec(text)) !== null) {
        if (pattern === tagPatterns[2]) {
          // Split comma-separated tags
          const tags = tagMatch[1].split(',').map(t => t.trim().toLowerCase());
          metadata.tags.push(...tags);
        } else {
          metadata.tags.push(tagMatch[1].toLowerCase());
        }
      }
    }

    // Remove duplicates
    metadata.tags = [...new Set(metadata.tags)];

    return metadata;
  }

  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Detect content language
   */
  static detectLanguage(text: string): string {
    // Simple language detection based on common words
    const sample = text.substring(0, 1000).toLowerCase();
    
    const patterns = {
      'en': /\b(the|and|that|have|for|not|with|you|this|but|his|from|they)\b/g,
      'es': /\b(que|de|no|un|se|es|en|lo|le|da|su|por|son|con|para)\b/g,
      'fr': /\b(de|le|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son)\b/g,
      'de': /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist)\b/g,
      'ru': /\b(не|в|и|на|что|с|он|как|по|это|за|к|из|у|от|для)\b/g,
    };

    let bestLanguage = 'en';
    let maxMatches = 0;

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = sample.match(pattern);
      const matchCount = matches ? matches.length : 0;
      
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestLanguage = lang;
      }
    }

    return bestLanguage;
  }
}

/**
 * Advanced text chunking with overlap and structure preservation
 */
export class SmartTextChunker {
  private config: RAGConfig['processing'];

  constructor(config: RAGConfig['processing']) {
    this.config = config;
  }

  /**
   * Split text into overlapping chunks with structure awareness
   */
  chunkText(text: string, metadata?: any): DocumentChunk[] {
    const cleanText = TextPreprocessor.cleanText(text);
    const textMetadata = TextPreprocessor.extractMetadata(cleanText);
    
    if (cleanText.length <= this.config.chunkSize) {
      return [{
        id: this.generateChunkId(),
        content: cleanText,
        metadata: {
          sourceUri: metadata?.sourceUri || '',
          serverId: metadata?.serverId || '',
          chunkIndex: 0,
          totalChunks: 1,
          tokenCount: TextPreprocessor.estimateTokens(cleanText),
          created: Date.now(),
          title: textMetadata.title,
          tags: textMetadata.tags,
        }
      }];
    }

    const chunks: DocumentChunk[] = [];
    
    // First, try to chunk by sections if structure is preserved
    if (this.config.preserveStructure && textMetadata.sections.length > 0) {
      chunks.push(...this.chunkByStructure(cleanText, textMetadata, metadata));
    } else {
      chunks.push(...this.chunkBySize(cleanText, metadata));
    }

    // Add chunk indices and total count
    chunks.forEach((chunk, index) => {
      chunk.metadata.chunkIndex = index;
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Chunk text by preserving structure (sections, paragraphs)
   */
  private chunkByStructure(
    text: string, 
    textMetadata: any, 
    metadata?: any
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = textMetadata.sections;
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];
      
      const sectionStart = section.end;
      const sectionEnd = nextSection ? nextSection.start : text.length;
      const sectionText = text.substring(sectionStart, sectionEnd).trim();
      
      if (sectionText.length < this.config.minChunkSize) {
        continue;
      }

      if (sectionText.length <= this.config.chunkSize) {
        chunks.push({
          id: this.generateChunkId(),
          content: sectionText,
          metadata: {
            sourceUri: metadata?.sourceUri || '',
            serverId: metadata?.serverId || '',
            chunkIndex: 0,
            totalChunks: 0,
            tokenCount: TextPreprocessor.estimateTokens(sectionText),
            created: Date.now(),
            section: section.title,
            title: textMetadata.title,
            tags: textMetadata.tags,
          }
        });
      } else {
        // Section is too large, chunk it further
        const sectionChunks = this.chunkBySize(sectionText, {
          ...metadata,
          section: section.title,
        });
        chunks.push(...sectionChunks);
      }
    }

    return chunks;
  }

  /**
   * Chunk text by size with smart boundaries
   */
  private chunkBySize(text: string, metadata?: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const separators = [...this.config.separators].sort((a, b) => b.length - a.length);
    
    let currentPosition = 0;
    
    while (currentPosition < text.length) {
      let chunkEnd = Math.min(currentPosition + this.config.chunkSize, text.length);
      
      // If we're not at the end, try to find a good boundary
      if (chunkEnd < text.length) {
        let bestBoundary = chunkEnd;
        
        // Look backwards for the best separator
        for (let i = chunkEnd; i > currentPosition + this.config.chunkSize * 0.7; i--) {
          for (const separator of separators) {
            if (text.substring(i, i + separator.length) === separator) {
              bestBoundary = i + separator.length;
              break;
            }
          }
          if (bestBoundary < chunkEnd) break;
        }
        
        chunkEnd = bestBoundary;
      }

      const chunkText = text.substring(currentPosition, chunkEnd).trim();
      
      if (chunkText.length >= this.config.minChunkSize) {
        chunks.push({
          id: this.generateChunkId(),
          content: chunkText,
          metadata: {
            sourceUri: metadata?.sourceUri || '',
            serverId: metadata?.serverId || '',
            chunkIndex: 0,
            totalChunks: 0,
            tokenCount: TextPreprocessor.estimateTokens(chunkText),
            created: Date.now(),
            section: metadata?.section,
            title: metadata?.title,
            tags: metadata?.tags || [],
          }
        });
      }

      // Move to next chunk with overlap
      currentPosition = chunkEnd - this.config.chunkOverlap;
      
      // Ensure we make progress
      if (currentPosition <= chunkEnd - this.config.chunkSize) {
        currentPosition = chunkEnd;
      }
    }

    return chunks;
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Multi-format document processor
 */
export class DocumentProcessingPipeline implements DocumentProcessor {
  supportedTypes = ['text', 'markdown', 'json', 'xml', 'html'];
  
  private chunker: SmartTextChunker;
  private config: RAGConfig['processing'];

  constructor(config: RAGConfig['processing']) {
    this.config = config;
    this.chunker = new SmartTextChunker(config);
  }

  /**
   * Process document content into chunks
   */
  async process(content: string, metadata: {
    sourceUri: string;
    serverId: string;
    contentType?: string;
    lastModified?: number;
  }): Promise<DocumentChunk[]> {
    try {
      if (!content || content.trim().length === 0) {
        throw new ProcessingError('Cannot process empty content');
      }

      // Detect content type if not provided
      const contentType = metadata.contentType || this.detectContentType(content);
      
      // Preprocess based on content type
      let processedContent = content;
      try {
        processedContent = await this.preprocessByType(content, contentType);
      } catch (error) {
        console.warn(`Failed to preprocess ${contentType} content, using as-is:`, error);
        processedContent = content;
      }

      // Extract additional metadata
      const textMetadata = TextPreprocessor.extractMetadata(processedContent);
      const language = TextPreprocessor.detectLanguage(processedContent);

      // Chunk the content
      const chunks = this.chunker.chunkText(processedContent, {
        ...metadata,
        contentType,
        language,
        title: textMetadata.title,
        tags: textMetadata.tags,
      });

      if (chunks.length === 0) {
        throw new ProcessingError('No valid chunks generated from content');
      }

      return chunks;
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }
      throw new ProcessingError(
        `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sourceUri: metadata.sourceUri, contentLength: content.length }
      );
    }
  }

  /**
   * Simple chunking for basic use cases
   */
  chunkText(text: string, options?: any): string[] {
    const chunks = this.chunker.chunkText(text, options);
    return chunks.map(chunk => chunk.content);
  }

  /**
   * Detect content type from content
   */
  private detectContentType(content: string): string {
    const sample = content.substring(0, 1000);
    
    if (sample.includes('```') || sample.match(/^#{1,6}\s/m)) {
      return 'markdown';
    }
    
    if (sample.trim().startsWith('<') && sample.includes('>')) {
      if (sample.includes('<!DOCTYPE html') || sample.includes('<html')) {
        return 'html';
      }
      if (sample.includes('<?xml')) {
        return 'xml';
      }
    }
    
    if (sample.trim().startsWith('{') || sample.trim().startsWith('[')) {
      try {
        JSON.parse(sample);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }
    
    return 'text';
  }

  /**
   * Preprocess content based on type
   */
  private async preprocessByType(content: string, contentType: string): Promise<string> {
    switch (contentType) {
      case 'markdown':
        return this.preprocessMarkdown(content);
      
      case 'html':
        return this.preprocessHTML(content);
      
      case 'json':
        return this.preprocessJSON(content);
      
      case 'xml':
        return this.preprocessXML(content);
      
      default:
        return TextPreprocessor.cleanText(content);
    }
  }

  /**
   * Preprocess Markdown content
   */
  private preprocessMarkdown(content: string): string {
    return content
      // Remove code block markers but keep content
      .replace(/```[\w]*\n([\s\S]*?)\n```/g, '$1')
      // Convert headers to plain text with section markers
      .replace(/^#{1,6}\s+(.+)$/gm, '\n=== $1 ===\n')
      // Convert lists to plain text
      .replace(/^\s*[-*+]\s+/gm, '• ')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove image syntax
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Clean up
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`([^`]+)`/g, '$1'); // Inline code
  }

  /**
   * Preprocess HTML content
   */
  private preprocessHTML(content: string): string {
    return content
      // Remove script and style tags completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Convert headers to section markers
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n=== $1 ===\n')
      // Convert paragraphs
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      // Convert lists
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      // Remove all HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Preprocess JSON content
   */
  private preprocessJSON(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return this.jsonToText(parsed);
    } catch {
      return content;
    }
  }

  private jsonToText(obj: any, prefix = ''): string {
    if (typeof obj === 'string') {
      return obj;
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj.toString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.jsonToText(item)).join('\n');
    }
    
    if (obj && typeof obj === 'object') {
      return Object.entries(obj)
        .map(([key, value]) => {
          const text = this.jsonToText(value);
          return text ? `${key}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n');
    }
    
    return '';
  }

  /**
   * Preprocess XML content
   */
  private preprocessXML(content: string): string {
    return content
      // Remove XML declaration and comments
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // Convert to simple text
      .replace(/<([^>]+)>/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ');
  }
}