/**
 * Example RAG Configuration with Query Analysis
 * Shows how to configure the intelligent server/tool selection system
 */

import { RAGConfig, QueryCategory } from './types';

export const defaultRAGConfig: RAGConfig = {
  // Vector embedding configuration
  embedding: {
    dimensions: 384,
    model: 'all-MiniLM-L6-v2',
    batchSize: 32,
    maxTokensPerChunk: 512,
  },

  // Document processing
  processing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    separators: ['\n\n', '\n', '.', '!', '?'],
    preserveStructure: true,
  },

  // Retrieval settings
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    maxContextLength: 4000,
    rerankResults: true,
  },

  // MCP tool configuration with intelligent prioritization
  tools: {
    enabled: true,
    priorities: [
      'microsoft_docs_search',
      'brave_web_search',
      'github_search_code',
      'context7_get_library_docs'
    ],
    timeoutMs: 10000,
    fallbackToVectorSearch: true,
  },

  // Query analysis configuration - NEW FEATURE
  queryAnalysis: {
    enabled: true,
    dynamicPrioritization: true,
    confidenceThreshold: 0.4, // 40% confidence required for tool reordering
    patterns: [
      {
        category: QueryCategory.MICROSOFT_AZURE,
        keywords: [
          'azure', 'microsoft', 'office 365', 'sharepoint', 'teams',
          'powershell', 'active directory', '.net', 'sql server'
        ],
        regexPatterns: ['microsoft\\s+\\w+', 'azure\\s+\\w+', '\\.net\\s+'],
        toolPriorities: ['microsoft_docs_search', 'microsoft_docs_fetch', 'brave_web_search'],
        boost: 1.8 // Higher boost for Microsoft queries
      },
      {
        category: QueryCategory.PROGRAMMING_CODE,
        keywords: [
          'javascript', 'typescript', 'react', 'node', 'python',
          'function', 'method', 'class', 'interface', 'library'
        ],
        regexPatterns: ['\\b(function|method|class)\\s+\\w+', 'import\\s+\\w+'],
        toolPriorities: ['github_search_code', 'context7_get_library_docs', 'microsoft_docs_search'],
        boost: 1.5
      },
      {
        category: QueryCategory.TROUBLESHOOTING,
        keywords: [
          'error', 'issue', 'problem', 'fix', 'debug', 'not working', 'failed'
        ],
        regexPatterns: ['\\w+\\s+error', 'how\\s+to\\s+fix', 'not\\s+working'],
        toolPriorities: ['brave_web_search', 'github_search_issues', 'microsoft_docs_search'],
        boost: 1.6 // High priority for troubleshooting
      }
    ]
  },

  // Cache configuration
  cache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 3600,
    persistToDisk: true,
  },

  // Performance optimizations
  performance: {
    enableParallelProcessing: true,
    maxConcurrentRequests: 5,
    requestTimeoutMs: 30000,
    enableCompression: true,
  },
};

// Example usage scenarios
export const exampleQueries = {
  microsoftQueries: [
    'How to use Azure Functions with .NET?',
    'SharePoint Online permissions setup',
    'PowerShell script for Active Directory'
  ],
  programmingQueries: [
    'React hooks tutorial',
    'Node.js authentication middleware',
    'Python pandas dataframe operations'
  ],
  troubleshootingQueries: [
    'JavaScript module not found error',
    'Azure deployment failed',
    'React component not rendering'
  ],
  generalQueries: [
    'Latest web development trends',
    'Best practices for mobile apps',
    'Performance optimization techniques'
  ]
};

/**
 * How the query analysis works:
 * 
 * 1. When a query is processed, the analyzeQuery() method:
 *    - Matches keywords and regex patterns
 *    - Calculates confidence scores
 *    - Determines the primary category
 *    - Recommends tool priorities
 * 
 * 2. If confidence >= threshold (0.4), priorities are adjusted:
 *    - Recommended tools are moved to the front
 *    - Default tools are appended
 * 
 * 3. Examples of dynamic prioritization:
 * 
 *    Query: "Azure Functions tutorial"
 *    Default:  [microsoft_docs_search, brave_web_search, github_search_code]
 *    Adjusted: [microsoft_docs_search, microsoft_docs_fetch, brave_web_search, github_search_code]
 * 
 *    Query: "React component error"
 *    Default:  [microsoft_docs_search, brave_web_search, github_search_code]
 *    Adjusted: [brave_web_search, github_search_issues, microsoft_docs_search, github_search_code]
 * 
 *    Query: "Node.js authentication"
 *    Default:  [microsoft_docs_search, brave_web_search, github_search_code]
 *    Adjusted: [github_search_code, context7_get_library_docs, microsoft_docs_search, brave_web_search]
 */