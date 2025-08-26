/**
 * Vector Embedding Service
 * Handles text-to-vector conversion with caching and optimization
 */

import { EmbeddingProvider, EmbeddingError, RAGConfig } from './types';
import { MMKV } from 'react-native-mmkv';

/**
 * Simple TF-IDF based embedding provider for mobile
 * Optimized for on-device processing without external API dependencies
 */
export class MobileTFIDFEmbedding implements EmbeddingProvider {
  name = 'mobile-tfidf';
  dimensions: number;
  maxTokens: number;
  
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;
  private cache: MMKV;

  constructor(dimensions: number = 384, maxTokens: number = 512) {
    this.dimensions = dimensions;
    this.maxTokens = maxTokens;
    this.cache = new MMKV({ id: 'embeddings-cache' });
    this.loadVocabulary();
  }

  private loadVocabulary(): void {
    try {
      const vocabData = this.cache.getString('vocabulary');
      const idfData = this.cache.getString('idf');
      const docCount = this.cache.getNumber('documentCount');

      if (vocabData && idfData && docCount) {
        const vocabArray = JSON.parse(vocabData);
        const idfArray = JSON.parse(idfData);
        
        this.vocabulary = new Map(vocabArray);
        this.idf = new Map(idfArray);
        this.documentCount = docCount;
        
        console.log(`Loaded vocabulary with ${this.vocabulary.size} terms, ${this.documentCount} documents`);
      }
    } catch (error) {
      console.log('No cached vocabulary found, will build from scratch');
    }
  }

  private saveVocabulary(): void {
    try {
      this.cache.set('vocabulary', JSON.stringify(Array.from(this.vocabulary.entries())));
      this.cache.set('idf', JSON.stringify(Array.from(this.idf.entries())));
      this.cache.set('documentCount', this.documentCount);
    } catch (error) {
      console.error('Failed to cache vocabulary:', error);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1 && token.length < 20);
  }

  private updateVocabulary(texts: string[]): void {
    const documentTermFreq = new Map<string, Set<number>>();
    
    texts.forEach((text, docIdx) => {
      const tokens = this.tokenize(text);
      const uniqueTokens = new Set(tokens);
      
      uniqueTokens.forEach(token => {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
        
        if (!documentTermFreq.has(token)) {
          documentTermFreq.set(token, new Set());
        }
        documentTermFreq.get(token)!.add(docIdx);
      });
    });

    this.documentCount += texts.length;

    // Update IDF scores
    for (const [term, docs] of documentTermFreq) {
      const df = docs.size;
      const idf = Math.log(this.documentCount / (df + 1));
      this.idf.set(term, idf);
    }

    this.saveVocabulary();
  }

  private computeTFIDF(text: string): Map<string, number> {
    const tokens = this.tokenize(text.substring(0, this.maxTokens * 4)); // Rough token limit
    const termFreq = new Map<string, number>();
    
    // Compute term frequencies
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });

    // Normalize by document length
    const totalTerms = tokens.length;
    const tfidf = new Map<string, number>();
    
    for (const [term, tf] of termFreq) {
      if (this.vocabulary.has(term) && this.idf.has(term)) {
        const normalizedTF = tf / totalTerms;
        const idfScore = this.idf.get(term)!;
        tfidf.set(term, normalizedTF * idfScore);
      }
    }

    return tfidf;
  }

  private tfidfToVector(tfidf: Map<string, number>): number[] {
    const vector = new Array(this.dimensions).fill(0);
    
    for (const [term, score] of tfidf) {
      const vocabIndex = this.vocabulary.get(term);
      if (vocabIndex !== undefined) {
        const vectorIndex = vocabIndex % this.dimensions;
        vector[vectorIndex] += score;
      }
    }

    // L2 normalization
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i] / magnitude;
      }
    }

    return vector;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      // Update vocabulary if needed
      if (texts.length > 0) {
        this.updateVocabulary(texts);
      }

      const embeddings: number[][] = [];
      
      for (const text of texts) {
        const embedding = await this.embedSingle(text);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      throw new EmbeddingError(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    try {
      // Check cache first
      const cacheKey = `embed_${this.hashText(text)}`;
      const cached = this.cache.getString(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const tfidf = this.computeTFIDF(text);
      const vector = this.tfidfToVector(tfidf);
      
      // Cache the result
      this.cache.set(cacheKey, JSON.stringify(vector));
      
      return vector;
    } catch (error) {
      throw new EmbeddingError(`Failed to generate single embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  getVocabularyStats(): { size: number; documentCount: number } {
    return {
      size: this.vocabulary.size,
      documentCount: this.documentCount,
    };
  }

  clearCache(): void {
    this.cache.clearAll();
    this.vocabulary.clear();
    this.idf.clear();
    this.documentCount = 0;
  }
}

/**
 * Embedding Service with provider management and optimization
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;
  private config: RAGConfig['embedding'];
  private cache: MMKV;
  private batchQueue: Array<{ text: string; resolve: Function; reject: Function }> = [];
  private processingBatch = false;

  constructor(config: RAGConfig['embedding']) {
    this.config = config;
    this.cache = new MMKV({ id: 'embedding-service' });
    
    // Initialize provider based on config
    this.provider = new MobileTFIDFEmbedding(
      config.dimensions,
      config.maxTokensPerChunk
    );
  }

  /**
   * Embed a single text with caching
   */
  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError('Cannot embed empty text');
    }

    try {
      return await this.provider.embedSingle(text);
    } catch (error) {
      throw new EmbeddingError(
        `Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { text: text.substring(0, 100) }
      );
    }
  }

  /**
   * Embed multiple texts with batching
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim().length > 0);
      
      if (validTexts.length === 0) {
        return [];
      }

      // Process in batches to avoid memory issues
      const results: number[][] = [];
      const batchSize = this.config.batchSize;
      
      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);
        const batchResults = await this.provider.embed(batch);
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      throw new EmbeddingError(
        `Batch embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { textCount: texts.length }
      );
    }
  }

  /**
   * Add text to batch processing queue
   */
  async embedTextBatched(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ text, resolve, reject });
      this.processBatchQueue();
    });
  }

  private async processBatchQueue(): Promise<void> {
    if (this.processingBatch || this.batchQueue.length === 0) {
      return;
    }

    this.processingBatch = true;

    try {
      const batch = this.batchQueue.splice(0, this.config.batchSize);
      const texts = batch.map(item => item.text);
      const embeddings = await this.provider.embed(texts);

      batch.forEach((item, index) => {
        item.resolve(embeddings[index]);
      });
    } catch (error) {
      this.batchQueue.forEach(item => item.reject(error));
    } finally {
      this.processingBatch = false;
      
      // Process remaining queue if any
      if (this.batchQueue.length > 0) {
        setTimeout(() => this.processBatchQueue(), 100);
      }
    }
  }

  /**
   * Calculate cosine similarity between vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find most similar vectors
   */
  findMostSimilar(
    queryVector: number[],
    candidates: Array<{ vector: number[]; id: string; data?: any }>,
    topK: number = 5
  ): Array<{ id: string; similarity: number; data?: any }> {
    const similarities = candidates.map(candidate => ({
      id: candidate.id,
      similarity: this.cosineSimilarity(queryVector, candidate.vector),
      data: candidate.data,
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get embedding provider info
   */
  getProviderInfo(): { name: string; dimensions: number; maxTokens: number } {
    return {
      name: this.provider.name,
      dimensions: this.provider.dimensions,
      maxTokens: this.provider.maxTokens,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clearAll();
    if (this.provider instanceof MobileTFIDFEmbedding) {
      this.provider.clearCache();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits?: number } {
    // Basic cache size estimation
    const allKeys = this.cache.getAllKeys();
    return {
      size: allKeys.length,
    };
  }
}