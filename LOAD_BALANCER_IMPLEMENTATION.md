# MCP Load Balancer Implementation

This document describes the implementation of server prioritization and load balancing for the Model Context Protocol (MCP) system in the Cactus Chat application.

## Overview

The load balancing system provides intelligent server selection, health tracking, and performance optimization for MCP tool calls. It automatically routes requests to the best available servers based on real-time metrics and configurable strategies.

## Features

### 🎯 Server Health Tracking
- **Response Time Monitoring**: Rolling average of response times (configurable window size)
- **Success Rate Calculation**: Tracks success/failure ratio over last 100 requests  
- **Current Load Tracking**: Active request count per server
- **Availability Status**: Health state with automatic recovery
- **Circuit Breaker Pattern**: Prevents cascading failures

### ⚖️ Load Balancing Strategies
- **Round Robin**: Distributes requests evenly across servers
- **Least Loaded**: Routes to server with lowest active request count
- **Fastest Response**: Prioritizes servers with lowest average response time
- **Weighted**: Combines success rate, response time, and load factors

### 🔄 Automatic Recovery
- **Failure Threshold**: Mark servers unhealthy after N consecutive failures
- **Cooldown Period**: Auto-recovery after configurable cooldown time
- **Progressive Health Checks**: Gradual re-introduction of recovered servers

### 💾 Persistent Metrics
- **Storage Integration**: Metrics persist across app restarts
- **Performance History**: Maintains historical performance data
- **Configurable Retention**: Configurable data retention policies

## Implementation Files

### 📁 Core Files Created/Modified

#### 1. `/services/mcp/load-balancer.ts` - **NEW**
Main load balancer implementation with:
- `MCPLoadBalancer` class
- Health metrics tracking
- Strategy implementations
- Circuit breaker logic
- Persistent storage integration

#### 2. `/services/rag/retrieval.ts` - **MODIFIED**
Enhanced document retrieval engine with:
- Load balancer integration
- Server selection logic
- Performance monitoring
- Error handling and recovery

#### 3. `/services/rag/types.ts` - **MODIFIED**
Added load balancing type definitions:
- `LoadBalancingStrategy` enum
- `ServerHealthMetrics` interface  
- `LoadBalancingConfig` interface
- `ServerSelectionResult` interface

#### 4. `/services/mcp/index.ts` - **MODIFIED**
Enhanced MCP service with:
- `getServersForTool()` method
- Server availability checking
- Load balancer compatibility

## Usage Examples

### Basic Server Selection
```typescript
import { loadBalancer, LoadBalancingStrategy } from '../mcp/load-balancer';

// Get available servers for a tool
const availableServers = await mcpService.getServersForTool('microsoft_docs_search');

// Select best server using weighted strategy
const selectedServer = loadBalancer.selectServer(
  availableServers, 
  LoadBalancingStrategy.WEIGHTED
);
```

### Health Monitoring
```typescript
// Get health metrics for all servers
const healthMetrics = loadBalancer.getAllServerHealth();

// Check specific server health
const serverHealth = loadBalancer.getServerHealth('server-1');
console.log(`Server health: ${serverHealth.isHealthy ? 'Healthy' : 'Unhealthy'}`);
console.log(`Response time: ${serverHealth.responseTimeAverage.toFixed(1)}ms`);
console.log(`Success rate: ${(serverHealth.successRate * 100).toFixed(1)}%`);
```

### Manual Request Tracking
```typescript
// Track request lifecycle manually
loadBalancer.trackRequest('server-1', 'microsoft_docs_search');

try {
  const result = await callMCPTool('server-1', 'microsoft_docs_search', params);
  loadBalancer.trackResponse('server-1', true, responseTime);
  return result;
} catch (error) {
  loadBalancer.trackResponse('server-1', false, responseTime);
  throw error;
}
```

### Configuration Management
```typescript
// Update load balancing strategy
loadBalancer.updateConfig({
  strategy: LoadBalancingStrategy.LEAST_LOADED,
  maxFailuresBeforeUnhealthy: 5,
  unhealthyCooldownMs: 60000 // 1 minute
});

// Reset metrics for problematic server
loadBalancer.resetMetrics('problematic-server');
```

## Configuration Options

### Load Balancing Configuration
```typescript
interface LoadBalancingConfig {
  strategy: LoadBalancingStrategy;           // Default: WEIGHTED
  maxFailuresBeforeUnhealthy: number;        // Default: 3
  unhealthyCooldownMs: number;               // Default: 30000 (30s)
  responseTimeWindowSize: number;            // Default: 20
  successRateWindowSize: number;             // Default: 100
  circuitBreakerThreshold: number;           // Default: 0.5
}
```

### Strategy Details

#### 1. **WEIGHTED** (Recommended)
Combines multiple factors with configurable weights:
- Success rate: 60% weight
- Response time: 30% weight  
- Current load: 10% weight

#### 2. **ROUND_ROBIN**
Simple round-robin distribution:
- Ensures even request distribution
- Good for uniform server capabilities
- No performance considerations

#### 3. **LEAST_LOADED**
Routes to server with lowest active requests:
- Prevents server overload
- Good for varying request durations
- Real-time load balancing

#### 4. **FASTEST_RESPONSE**
Prioritizes servers with best response times:
- Optimizes for speed
- Good for latency-sensitive applications
- May create uneven load distribution

## Integration with RAG System

### Automatic Integration
The load balancer is automatically integrated with the RAG (Retrieval-Augmented Generation) system:

1. **Tool Discovery**: System discovers available servers for each tool
2. **Server Selection**: Load balancer selects optimal server
3. **Request Execution**: Tool call executed on selected server
4. **Metrics Tracking**: Response time and success tracked automatically
5. **Health Updates**: Server health status updated in real-time

### RAG Service Methods
```typescript
// Get load balancer health data
const healthData = ragService.getLoadBalancerHealth();

// Reset server metrics
ragService.resetServerMetrics('server-1');

// Update load balancing strategy
ragService.updateLoadBalancingStrategy(LoadBalancingStrategy.FASTEST_RESPONSE);
```

## Performance Metrics

### Tracked Metrics
- **Response Time**: Rolling average with configurable window
- **Success Rate**: Percentage of successful requests
- **Current Load**: Number of active requests
- **Total Requests**: Lifetime request count
- **Total Failures**: Lifetime failure count
- **Last Failure Time**: Timestamp of most recent failure

### Health Determination
Server health is determined by:
1. **Consecutive Failures**: < `maxFailuresBeforeUnhealthy`
2. **Recovery Time**: Time since last failure > `unhealthyCooldownMs`
3. **Circuit Breaker**: Success rate > `circuitBreakerThreshold`

## Error Handling

### Failure Scenarios
- **Server Timeout**: Automatic failover to next available server
- **Connection Errors**: Server marked unhealthy, requests rerouted  
- **No Available Servers**: Graceful degradation with error reporting
- **Partial Failures**: Circuit breaker prevents cascade failures

### Recovery Mechanisms
- **Automatic Recovery**: Servers auto-recover after cooldown period
- **Manual Reset**: Operators can manually reset server metrics
- **Gradual Re-introduction**: Recovered servers gradually receive traffic

## Monitoring and Debugging

### Debug Information
The load balancer provides extensive logging:
```typescript
console.log(`[LoadBalancer] Tracking request to ${serverId} for ${toolName}`);
console.log(`[LoadBalancer] Selected server ${serverId} using ${strategy} strategy`);
console.log(`[LoadBalancer] Server ${serverId} responded in ${responseTime}ms`);
```

### Health Monitoring
```typescript
// Monitor server health
const health = loadBalancer.getAllServerHealth();
health.forEach(server => {
  console.log(`${server.serverId}: ${server.isHealthy ? '✅' : '❌'} ` +
             `${server.responseTimeAverage.toFixed(1)}ms ` +
             `${(server.successRate * 100).toFixed(1)}% success`);
});
```

## Storage and Persistence

### AsyncStorage Integration
- **Metrics Persistence**: Health metrics survive app restarts
- **Fallback Storage**: Graceful degradation if AsyncStorage unavailable
- **Configurable TTL**: Automatic cleanup of old metrics
- **Storage Keys**: Namespaced to prevent conflicts

### Storage Format
```typescript
interface StoredMetrics {
  serverId: string;
  responseTimes: number[];        // Last N response times
  recentRequests: RequestData[];  // Last N requests with success/failure
  isHealthy: boolean;
  lastFailureTime?: number;
  consecutiveFailures: number;
}
```

## Future Enhancements

### Planned Features
- **Predictive Routing**: ML-based server selection
- **Geographic Routing**: Location-aware server selection  
- **Custom Metrics**: Application-specific health indicators
- **Dashboard UI**: Visual server health monitoring
- **Advanced Strategies**: Adaptive and learning algorithms

### Integration Opportunities
- **Cactus Agent**: Integration with agent tool calling
- **RAG Pipeline**: Enhanced retrieval performance
- **Model Management**: Load balancing for local models
- **API Gateway**: External service load balancing

## Testing

### Unit Tests (Recommended)
```typescript
describe('MCPLoadBalancer', () => {
  it('should select server with best weighted score', () => {
    // Test weighted selection algorithm
  });
  
  it('should mark server unhealthy after max failures', () => {
    // Test circuit breaker functionality
  });
  
  it('should recover server after cooldown period', () => {
    // Test automatic recovery
  });
});
```

### Integration Tests
- End-to-end server selection and routing
- Performance under load scenarios
- Failure recovery mechanisms
- Metrics persistence and recovery

## Performance Impact

### Memory Usage
- **Minimal Overhead**: ~1KB per server for metrics
- **Configurable Windows**: Adjustable metric retention
- **Automatic Cleanup**: Old metrics automatically purged

### CPU Usage
- **Efficient Selection**: O(n) server selection algorithms
- **Lazy Calculation**: Metrics calculated on-demand
- **Background Processing**: Async metric persistence

### Network Impact
- **No Additional Requests**: Uses existing request/response cycle
- **Reduced Failed Requests**: Better server selection reduces failures
- **Improved Latency**: Routes to fastest available servers

---

## Summary

The MCP Load Balancer provides production-ready server selection and health management for the Cactus Chat application. It combines intelligent routing algorithms with comprehensive health monitoring to ensure optimal performance and reliability of MCP tool calls.

Key benefits:
- ✅ **Improved Performance**: Faster response times through intelligent routing
- ✅ **Enhanced Reliability**: Automatic failover and recovery mechanisms  
- ✅ **Better User Experience**: Reduced failures and faster tool responses
- ✅ **Operational Visibility**: Comprehensive health monitoring and debugging
- ✅ **Production Ready**: Persistent metrics and robust error handling