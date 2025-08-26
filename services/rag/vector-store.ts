/**
 * Mobile-Optimized Vector Store
 * High-performance vector storage and similarity search for mobile devices
 */

import { MMKV } from 'react-native-mmkv';
import { DocumentChunk, VectorStore, RAGConfig, RetrievalError } from './types';
import { EmbeddingService } from './embeddings';

interface StoredChunk {
  chunk: DocumentChunk;
  vector: number[];
}

interface IndexStats {
  documentCount: number;
  chunkCount: number;
  indexSize: number;
  lastUpdated: number;
}

/**
 * Memory-optimized vector store with disk persistence
 */
export class MobileVectorStore implements VectorStore {
  private storage: MMKV;
  private memoryIndex: Map<string, StoredChunk> = new Map();
  private config: RAGConfig;
  private embeddingService: EmbeddingService;
  private isLoaded = false;

  constructor(config: RAGConfig, embeddingService: EmbeddingService, indexId: string = 'default') {
    this.config = config;
    this.embeddingService = embeddingService;
    this.storage = new MMKV({ id: `vector-store-${indexId}` });
    
    if (config.cache.enabled) {
      this.loadFromDisk();
    }
  }

  /**
   * Load index from persistent storage
   */
  private loadFromDisk(): void {
    try {
      const chunkIds = this.getStoredChunkIds();
      let loadedCount = 0;
      
      for (const chunkId of chunkIds) {
        try {
          const stored = this.loadChunkFromDisk(chunkId);
          if (stored) {
            this.memoryIndex.set(chunkId, stored);
            loadedCount++;
          }
        } catch (error) {
          console.warn(`Failed to load chunk ${chunkId}:`, error);
        }
      }

      this.isLoaded = true;
      console.log(`Loaded ${loadedCount} chunks into vector index`);
    } catch (error) {
      console.error('Failed to load vector index from disk:', error);
      this.isLoaded = true; // Continue with empty index
    }
  }

  private getStoredChunkIds(): string[] {
    try {
      const idsJson = this.storage.getString('chunk_ids');
      return idsJson ? JSON.parse(idsJson) : [];
    } catch {
      return [];
    }
  }

  private saveChunkIdsToDisk(chunkIds: string[]): void {
    this.storage.set('chunk_ids', JSON.stringify(chunkIds));
  }

  private loadChunkFromDisk(chunkId: string): StoredChunk | null {
    try {
      const chunkData = this.storage.getString(`chunk_${chunkId}`);
      const vectorData = this.storage.getString(`vector_${chunkId}`);
      
      if (chunkData && vectorData) {
        return {
          chunk: JSON.parse(chunkData),
          vector: JSON.parse(vectorData),
        };
      }
    } catch (error) {
      console.warn(`Failed to load chunk ${chunkId} from disk:`, error);
    }
    return null;
  }

  private saveChunkToDisk(chunkId: string, stored: StoredChunk): void {
    if (!this.config.cache.persistToDisk) {
      return;
    }

    try {
      this.storage.set(`chunk_${chunkId}`, JSON.stringify(stored.chunk));
      this.storage.set(`vector_${chunkId}`, JSON.stringify(stored.vector));
    } catch (error) {
      console.warn(`Failed to save chunk ${chunkId} to disk:`, error);
    }
  }

  private deleteChunkFromDisk(chunkId: string): void {
    this.storage.delete(`chunk_${chunkId}`);
    this.storage.delete(`vector_${chunkId}`);
  }

  /**
   * Add chunks to the vector store
   */
  async add(chunks: DocumentChunk[]): Promise<void> {
    if (!this.isLoaded) {
      await this.waitForLoad();
    }

    try {
      // Check memory limits
      if (this.memoryIndex.size + chunks.length > this.config.cache.maxSize) {
        await this.pruneIndex();
      }

      // Generate embeddings for chunks that don't have them
      const chunksNeedingEmbeddings = chunks.filter(chunk => !chunk.embedding);
      
      if (chunksNeedingEmbeddings.length > 0) {
        const texts = chunksNeedingEmbeddings.map(chunk => chunk.content);
        const embeddings = await this.embeddingService.embedTexts(texts);
        
        chunksNeedingEmbeddings.forEach((chunk, index) => {
          chunk.embedding = embeddings[index];
        });
      }

      // Add to memory index and persist
      const newChunkIds: string[] = [];
      
      for (const chunk of chunks) {
        if (!chunk.embedding) {
          console.warn(`Chunk ${chunk.id} has no embedding, skipping`);
          continue;
        }

        const stored: StoredChunk = {
          chunk: { ...chunk },
          vector: chunk.embedding,
        };

        this.memoryIndex.set(chunk.id, stored);
        this.saveChunkToDisk(chunk.id, stored);
        newChunkIds.push(chunk.id);
      }

      // Update chunk IDs list
      if (newChunkIds.length > 0) {
        const allChunkIds = [...new Set([...this.getStoredChunkIds(), ...newChunkIds])];
        this.saveChunkIdsToDisk(allChunkIds);
        this.updateStats();
      }

      console.log(`Added ${newChunkIds.length} chunks to vector store`);
    } catch (error) {
      throw new RetrievalError(
        `Failed to add chunks to vector store: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { chunkCount: chunks.length }
      );
    }
  }

  /**
   * Search for similar chunks
   */
  async search(queryVector: number[], options: {
    topK?: number;
    threshold?: number;
    filters?: {
      serverIds?: string[];
      uris?: string[];
      tags?: string[];
    };
  } = {}): Promise<DocumentChunk[]> {
    if (!this.isLoaded) {
      await this.waitForLoad();
    }

    const { topK = 5, threshold = 0.1, filters } = options;

    try {
      const candidates: Array<{ chunk: DocumentChunk; similarity: number }> = [];

      for (const [chunkId, stored] of this.memoryIndex) {
        const chunk = stored.chunk;
        
        // Apply filters
        if (filters) {
          if (filters.serverIds && !filters.serverIds.includes(chunk.metadata.serverId)) {
            continue;
          }
          if (filters.uris && !filters.uris.some(uri => chunk.metadata.sourceUri.includes(uri))) {
            continue;
          }
          if (filters.tags && filters.tags.length > 0) {
            const chunkTags = chunk.metadata.tags || [];
            if (!filters.tags.some(tag => chunkTags.includes(tag))) {
              continue;
            }
          }
        }

        // Calculate similarity
        const similarity = this.embeddingService.cosineSimilarity(queryVector, stored.vector);
        
        if (similarity >= threshold) {
          candidates.push({ chunk: { ...chunk, relevanceScore: similarity }, similarity });
        }
      }

      // Sort by similarity and take top K
      const results = candidates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(item => item.chunk);

      console.log(`Vector search returned ${results.length} results (threshold: ${threshold})`);
      return results;
    } catch (error) {
      throw new RetrievalError(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { queryDimensions: queryVector.length }
      );
    }
  }

  /**
   * Update an existing chunk
   */
  async update(chunkId: string, chunk: DocumentChunk): Promise<void> {
    if (!this.isLoaded) {
      await this.waitForLoad();
    }

    try {
      // Generate embedding if not provided
      if (!chunk.embedding) {
        chunk.embedding = await this.embeddingService.embedText(chunk.content);
      }

      const stored: StoredChunk = {
        chunk: { ...chunk },
        vector: chunk.embedding,
      };

      this.memoryIndex.set(chunkId, stored);
      this.saveChunkToDisk(chunkId, stored);
      this.updateStats();

      console.log(`Updated chunk ${chunkId} in vector store`);
    } catch (error) {
      throw new RetrievalError(
        `Failed to update chunk ${chunkId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a chunk from the store
   */
  async delete(chunkId: string): Promise<void> {
    if (!this.isLoaded) {
      await this.waitForLoad();
    }

    try {
      this.memoryIndex.delete(chunkId);
      this.deleteChunkFromDisk(chunkId);

      // Update chunk IDs list
      const chunkIds = this.getStoredChunkIds().filter(id => id !== chunkId);
      this.saveChunkIdsToDisk(chunkIds);
      this.updateStats();

      console.log(`Deleted chunk ${chunkId} from vector store`);
    } catch (error) {
      throw new RetrievalError(
        `Failed to delete chunk ${chunkId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear all chunks from the store
   */
  async clear(): Promise<void> {
    try {
      // Clear memory
      this.memoryIndex.clear();
      
      // Clear disk storage
      const chunkIds = this.getStoredChunkIds();
      for (const chunkId of chunkIds) {
        this.deleteChunkFromDisk(chunkId);
      }
      
      this.saveChunkIdsToDisk([]);
      this.updateStats();

      console.log('Cleared vector store');
    } catch (error) {
      throw new RetrievalError(
        `Failed to clear vector store: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<IndexStats> {
    const chunkIds = this.getStoredChunkIds();
    const uniqueDocuments = new Set<string>();
    
    for (const stored of this.memoryIndex.values()) {
      uniqueDocuments.add(stored.chunk.metadata.sourceUri);
    }

    return {
      documentCount: uniqueDocuments.size,
      chunkCount: chunkIds.length,
      indexSize: this.memoryIndex.size,
      lastUpdated: this.getLastUpdated(),
    };
  }

  /**
   * Prune index to stay within memory limits
   */
  private async pruneIndex(): Promise<void> {
    const maxSize = this.config.cache.maxSize;
    const currentSize = this.memoryIndex.size;
    
    if (currentSize <= maxSize) {
      return;
    }

    console.log(`Pruning vector index: ${currentSize} -> ${maxSize}`);

    // Sort by last access time or creation time
    const entries = Array.from(this.memoryIndex.entries())
      .sort((a, b) => a[1].chunk.metadata.created - b[1].chunk.metadata.created);

    // Remove oldest entries
    const entriesToRemove = currentSize - Math.floor(maxSize * 0.8); // Leave some headroom
    
    for (let i = 0; i < entriesToRemove; i++) {
      const [chunkId] = entries[i];
      this.memoryIndex.delete(chunkId);
      // Keep on disk but remove from memory
    }

    console.log(`Pruned ${entriesToRemove} entries from memory`);
  }

  private async waitForLoad(): Promise<void> {
    const timeout = 10000; // 10 seconds
    const start = Date.now();
    
    while (!this.isLoaded && (Date.now() - start) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isLoaded) {
      throw new RetrievalError('Vector store failed to load within timeout');
    }
  }

  private updateStats(): void {
    this.storage.set('last_updated', Date.now().toString());
  }

  private getLastUpdated(): number {
    const lastUpdated = this.storage.getString('last_updated');
    return lastUpdated ? parseInt(lastUpdated) : Date.now();
  }

  /**
   * Get chunks by document URI
   */
  getChunksByDocument(uri: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    for (const stored of this.memoryIndex.values()) {
      if (stored.chunk.metadata.sourceUri === uri) {
        chunks.push({ ...stored.chunk });
      }
    }

    return chunks.sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
  }

  /**
   * Get chunks by server ID
   */
  getChunksByServer(serverId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    for (const stored of this.memoryIndex.values()) {
      if (stored.chunk.metadata.serverId === serverId) {
        chunks.push({ ...stored.chunk });
      }
    }

    return chunks.sort((a, b) => a.metadata.created - b.metadata.created);
  }

  /**
   * Check if a chunk exists
   */
  hasChunk(chunkId: string): boolean {
    return this.memoryIndex.has(chunkId);
  }

  /**
   * Get a specific chunk
   */
  getChunk(chunkId: string): DocumentChunk | null {
    const stored = this.memoryIndex.get(chunkId);
    return stored ? { ...stored.chunk } : null;
  }

  /**
   * Compact storage by removing orphaned data
   */
  async compact(): Promise<{ removedChunks: number; reclaimedSpace: number }> {
    const validChunkIds = this.getStoredChunkIds();
    const allKeys = this.storage.getAllKeys();
    
    let removedChunks = 0;
    let reclaimedSpace = 0;
    
    for (const key of allKeys) {
      if (key.startsWith('chunk_') || key.startsWith('vector_')) {
        const chunkId = key.replace(/^(chunk_|vector_)/, '');
        if (!validChunkIds.includes(chunkId)) {
          const data = this.storage.getString(key);
          reclaimedSpace += data ? data.length : 0;
          this.storage.delete(key);
          removedChunks++;
        }
      }
    }

    if (removedChunks > 0) {
      console.log(`Compacted storage: removed ${removedChunks} orphaned entries`);
    }

    return { removedChunks: removedChunks / 2, reclaimedSpace }; // Divide by 2 since each chunk has 2 entries
  }
}