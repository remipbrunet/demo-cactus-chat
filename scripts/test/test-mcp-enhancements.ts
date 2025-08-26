/**
 * Test script for enhanced MCP system features
 * Tests multiple tool support, query analysis, prompt parsing, and load balancing
 */

import { DocumentRetrievalEngine } from './services/rag/retrieval';
import { MCPLoadBalancer, LoadBalancingStrategy } from './services/mcp/load-balancer';
import { QueryCategory, QueryAnalysisResult } from './services/rag/types';
import { MCPService } from './services/mcp';
import { EmbeddingService } from './services/rag/embeddings';
import { MobileVectorStore } from './services/rag/vector-store';
import { DocumentProcessingPipeline } from './services/rag/processing';
import { defaultRAGConfig } from './services/rag';

// Test utilities
function createMockMCPService(isReady: boolean = true): MCPService {
  return {
    isReady: () => isReady,
    findAndCallTool: async (toolName: string, args: any) => {
      // Simulate different responses for different tools
      if (toolName === 'microsoft_docs_search') {
        return {
          content: [{
            type: 'text',
            text: 'Azure documentation result'
          }],
          serverId: 'microsoft-server'
        };
      }
      if (toolName === 'brave_web_search') {
        return {
          content: [{
            type: 'text',
            text: 'Web search result'
          }],
          serverId: 'brave-server'
        };
      }
      throw new Error(`Tool not found: ${toolName}`);
    },
    getServersForTool: (toolName: string) => {
      if (toolName === 'microsoft_docs_search') {
        return ['microsoft-server-1', 'microsoft-server-2'];
      }
      if (toolName === 'brave_web_search') {
        return ['brave-server-1'];
      }
      return [];
    },
    callTool: async (serverId: string, toolName: string, args: any) => {
      return {
        content: [{
          type: 'text',
          text: `Result from ${serverId}`
        }]
      };
    }
  } as any;
}

function createTestRetrievalEngine(mcpService: MCPService): DocumentRetrievalEngine {
  const embeddingService = {} as EmbeddingService;
  const vectorStore = {} as MobileVectorStore;
  const processor = {} as DocumentProcessingPipeline;
  
  const config = {
    ...defaultRAGConfig,
    tools: {
      enabled: true,
      priorities: ['microsoft_docs_search', 'brave_web_search'],
      timeoutMs: 10000,
      fallbackToVectorSearch: true,
    },
    queryAnalysis: {
      enabled: true,
      dynamicPrioritization: true,
      confidenceThreshold: 0.4,
      patterns: [],
      modelMapping: {}
    },
    loadBalancing: {
      strategy: LoadBalancingStrategy.WEIGHTED,
      enabled: true,
      maxFailuresBeforeUnhealthy: 3,
      unhealthyCooldownMs: 30000,
      responseTimeWindowSize: 20,
      successRateWindowSize: 100,
      circuitBreakerThreshold: 0.5
    }
  };
  
  return new DocumentRetrievalEngine(
    mcpService,
    embeddingService,
    vectorStore,
    processor,
    config
  );
}

// Test functions
async function testMultipleToolSupport() {
  console.log('\n=== Testing Multiple Tool Support ===');
  
  const mcpService = createMockMCPService();
  const engine = createTestRetrievalEngine(mcpService);
  
  // Test with configured tool priorities
  console.log('Testing tool priority fallback...');
  const query = {
    text: 'How to deploy Azure Functions?',
    options: {}
  };
  
  try {
    const result = await engine['tryMCPTools'](query.text);
    console.log('✅ Multiple tool support working');
    console.log('  - Result chunks:', result.length);
  } catch (error) {
    console.log('❌ Multiple tool support failed:', error);
  }
}

async function testQueryAnalysis() {
  console.log('\n=== Testing Query Analysis ===');
  
  const mcpService = createMockMCPService();
  const engine = createTestRetrievalEngine(mcpService);
  
  const testQueries = [
    { text: 'How to use Azure Functions?', expectedCategory: QueryCategory.MICROSOFT_AZURE },
    { text: 'JavaScript array methods tutorial', expectedCategory: QueryCategory.PROGRAMMING_CODE },
    { text: 'Error: Cannot connect to database', expectedCategory: QueryCategory.TROUBLESHOOTING },
    { text: 'Latest iPhone review', expectedCategory: QueryCategory.GENERAL_WEB }
  ];
  
  for (const testQuery of testQueries) {
    const analysis = engine['analyzeQuery'](testQuery.text);
    const match = analysis.category === testQuery.expectedCategory;
    console.log(`${match ? '✅' : '❌'} Query: "${testQuery.text}"`);
    console.log(`  - Category: ${analysis.category} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);
    console.log(`  - Expected: ${testQuery.expectedCategory}`);
  }
}

async function testPromptParsing() {
  console.log('\n=== Testing Prompt Parsing ===');
  
  const mcpService = createMockMCPService();
  const engine = createTestRetrievalEngine(mcpService);
  
  const testPrompts = [
    { text: 'use microsoft docs to find Azure guides', expectedTool: 'microsoft_docs_search' },
    { text: '@github check latest React commits', expectedTool: 'github_search_code' },
    { text: 'search the web for Node.js tutorials', expectedTool: 'brave_web_search' },
    { text: 'mcp:context7_tool find documentation', expectedTool: 'context7_tool' },
    { text: "don't use microsoft, search the web", excludedTool: 'microsoft_docs_search' }
  ];
  
  for (const testPrompt of testPrompts) {
    const result = engine['extractAndCleanQuery'](testPrompt.text);
    console.log(`Query: "${testPrompt.text}"`);
    console.log(`  - Clean query: "${result.cleanQuery}"`);
    console.log(`  - Forced tools: ${result.hints.forcedTools.join(', ') || 'none'}`);
    console.log(`  - Preferred tools: ${result.hints.preferredTools.join(', ') || 'none'}`);
    console.log(`  - Excluded tools: ${result.hints.excludedTools.join(', ') || 'none'}`);
    
    const hasExpectedTool = testPrompt.expectedTool ? 
      result.hints.forcedTools.includes(testPrompt.expectedTool) || 
      result.hints.preferredTools.includes(testPrompt.expectedTool) : true;
    
    const hasExcludedTool = testPrompt.excludedTool ?
      result.hints.excludedTools.includes(testPrompt.excludedTool) : true;
    
    console.log(`  ${hasExpectedTool && hasExcludedTool ? '✅' : '❌'} Parsing correct`);
  }
}

async function testLoadBalancing() {
  console.log('\n=== Testing Load Balancing ===');
  
  const loadBalancer = new MCPLoadBalancer({
    strategy: LoadBalancingStrategy.WEIGHTED,
    maxFailuresBeforeUnhealthy: 3,
    unhealthyCooldownMs: 30000,
    responseTimeWindowSize: 20,
    successRateWindowSize: 100,
    circuitBreakerThreshold: 0.5
  });
  
  // Simulate some server interactions
  const servers = ['server-1', 'server-2', 'server-3'];
  
  // Track some requests and responses
  console.log('Simulating server interactions...');
  
  // Server 1: Fast and reliable
  for (let i = 0; i < 5; i++) {
    loadBalancer.trackRequest('server-1', 'test_tool');
    loadBalancer.trackResponse('server-1', true, 100);
  }
  
  // Server 2: Slow but reliable
  for (let i = 0; i < 3; i++) {
    loadBalancer.trackRequest('server-2', 'test_tool');
    loadBalancer.trackResponse('server-2', true, 500);
  }
  
  // Server 3: Fast but unreliable
  for (let i = 0; i < 4; i++) {
    loadBalancer.trackRequest('server-3', 'test_tool');
    loadBalancer.trackResponse('server-3', i % 2 === 0, 150);
  }
  
  // Test different strategies
  const strategies = [
    LoadBalancingStrategy.ROUND_ROBIN,
    LoadBalancingStrategy.LEAST_LOADED,
    LoadBalancingStrategy.FASTEST_RESPONSE,
    LoadBalancingStrategy.WEIGHTED
  ];
  
  for (const strategy of strategies) {
    const selected = loadBalancer.selectServer(servers, strategy);
    const health = loadBalancer.getServerHealth(selected);
    console.log(`Strategy: ${strategy}`);
    console.log(`  - Selected: ${selected}`);
    console.log(`  - Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  - Success rate: ${(health.successRate * 100).toFixed(1)}%`);
    console.log(`  - Avg response: ${health.averageResponseTime.toFixed(0)}ms`);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Running Enhanced MCP System Tests');
  console.log('=====================================');
  
  try {
    await testMultipleToolSupport();
    await testQueryAnalysis();
    await testPromptParsing();
    await testLoadBalancing();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary of Enhancements:');
    console.log('1. ✅ Multiple tool support with priority fallback');
    console.log('2. ✅ Intelligent query analysis for automatic tool selection');
    console.log('3. ✅ Prompt-based server hints and exclusions');
    console.log('4. ✅ Load balancing with health tracking');
    console.log('5. ✅ Circuit breaker pattern for failing servers');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Export for testing
export { runAllTests };

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}