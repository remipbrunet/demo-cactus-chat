// Note: In React Native environment, use @react-native-async-storage/async-storage
// For now we'll use a fallback storage implementation since this might not be available
// import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback storage for non-React Native environments
const createFallbackStorage = () => {
  const storage = new Map<string, string>();
  return {
    async setItem(key: string, value: string): Promise<void> {
      storage.set(key, value);
    },
    async getItem(key: string): Promise<string | null> {
      return storage.get(key) || null;
    }
  };
};

// Try to import AsyncStorage, fallback to simple storage
let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  console.warn('AsyncStorage not available, using fallback storage for load balancer');
  AsyncStorage = createFallbackStorage();
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  FASTEST_RESPONSE = 'fastest_response',
  WEIGHTED = 'weighted'
}

export interface HealthMetrics {
  serverId: string;
  responseTimeAverage: number;
  successRate: number;
  currentLoad: number;
  isHealthy: boolean;
  lastFailureTime?: number;
  totalRequests: number;
  totalFailures: number;
  lastResponseTime?: number;
}

export interface LoadBalancingConfig {
  strategy: LoadBalancingStrategy;
  maxFailuresBeforeUnhealthy: number;
  unhealthyCooldownMs: number;
  responseTimeWindowSize: number;
  successRateWindowSize: number;
  circuitBreakerThreshold: number;
}

interface ServerMetrics {
  serverId: string;
  responseTimes: number[];
  requests: Array<{ timestamp: number; success: boolean }>;
  activeRequests: number;
  isHealthy: boolean;
  lastFailureTime?: number;
  consecutiveFailures: number;
  roundRobinIndex: number;
}

export class MCPLoadBalancer {
  private serverMetrics: Map<string, ServerMetrics> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private config: LoadBalancingConfig;
  private storageKey = 'mcp_load_balancer_metrics';

  constructor(config?: Partial<LoadBalancingConfig>) {
    this.config = {
      strategy: LoadBalancingStrategy.WEIGHTED,
      maxFailuresBeforeUnhealthy: 3,
      unhealthyCooldownMs: 30000, // 30 seconds
      responseTimeWindowSize: 20,
      successRateWindowSize: 100,
      circuitBreakerThreshold: 0.5,
      ...config
    };

    this.loadMetricsFromStorage();
  }

  /**
   * Track when a request starts
   */
  trackRequest(serverId: string, toolName: string): void {
    this.ensureServerMetrics(serverId);
    const metrics = this.serverMetrics.get(serverId)!;
    metrics.activeRequests++;
    
    console.log(`[LoadBalancer] Tracking request to ${serverId} for ${toolName}. Active requests: ${metrics.activeRequests}`);
  }

  /**
   * Track request completion with response time and success status
   */
  trackResponse(serverId: string, success: boolean, responseTime: number): void {
    this.ensureServerMetrics(serverId);
    const metrics = this.serverMetrics.get(serverId)!;
    
    // Decrease active requests
    metrics.activeRequests = Math.max(0, metrics.activeRequests - 1);
    
    // Track response time (rolling window)
    metrics.responseTimes.push(responseTime);
    if (metrics.responseTimes.length > this.config.responseTimeWindowSize) {
      metrics.responseTimes.shift();
    }
    
    // Track success/failure (rolling window)
    const request = { timestamp: Date.now(), success };
    metrics.requests.push(request);
    if (metrics.requests.length > this.config.successRateWindowSize) {
      metrics.requests.shift();
    }
    
    // Update health status
    if (success) {
      metrics.consecutiveFailures = 0;
      // Auto-recover if server was unhealthy
      if (!metrics.isHealthy && this.shouldRecoverServer(serverId)) {
        metrics.isHealthy = true;
        console.log(`[LoadBalancer] Server ${serverId} recovered`);
      }
    } else {
      metrics.consecutiveFailures++;
      metrics.lastFailureTime = Date.now();
      
      // Mark unhealthy if too many consecutive failures
      if (metrics.consecutiveFailures >= this.config.maxFailuresBeforeUnhealthy) {
        metrics.isHealthy = false;
        console.log(`[LoadBalancer] Server ${serverId} marked unhealthy after ${metrics.consecutiveFailures} failures`);
      }
    }
    
    console.log(`[LoadBalancer] Response tracked for ${serverId}: success=${success}, time=${responseTime}ms, health=${metrics.isHealthy}`);
    
    // Persist metrics periodically
    this.saveMetricsToStorage();
  }

  /**
   * Select best server based on configured strategy
   */
  selectServer(availableServers: string[], strategy?: LoadBalancingStrategy): string | null {
    const activeStrategy = strategy || this.config.strategy;
    const healthyServers = availableServers.filter(serverId => this.isServerHealthy(serverId));
    
    if (healthyServers.length === 0) {
      console.warn(`[LoadBalancer] No healthy servers available from: ${availableServers.join(', ')}`);
      
      // Try to recover servers if cooldown period has passed
      const recoveredServers = availableServers.filter(serverId => this.shouldRecoverServer(serverId));
      if (recoveredServers.length > 0) {
        console.log(`[LoadBalancer] Attempting recovery for servers: ${recoveredServers.join(', ')}`);
        recoveredServers.forEach(serverId => {
          this.ensureServerMetrics(serverId);
          this.serverMetrics.get(serverId)!.isHealthy = true;
          this.serverMetrics.get(serverId)!.consecutiveFailures = 0;
        });
        return this.selectServerByStrategy(recoveredServers, activeStrategy);
      }
      
      // Fallback to any available server as last resort
      return availableServers.length > 0 ? availableServers[0] : null;
    }
    
    const selectedServer = this.selectServerByStrategy(healthyServers, activeStrategy);
    console.log(`[LoadBalancer] Selected server ${selectedServer} using ${activeStrategy} strategy from ${healthyServers.length} healthy servers`);
    
    return selectedServer;
  }

  /**
   * Get current health metrics for a server
   */
  getServerHealth(serverId: string): HealthMetrics {
    this.ensureServerMetrics(serverId);
    const metrics = this.serverMetrics.get(serverId)!;
    
    const responseTimeAverage = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length
      : 0;
    
    const recentRequests = metrics.requests.filter(req => 
      Date.now() - req.timestamp < 300000 // Last 5 minutes
    );
    
    const successRate = recentRequests.length > 0
      ? recentRequests.filter(req => req.success).length / recentRequests.length
      : 1.0;
    
    return {
      serverId,
      responseTimeAverage,
      successRate,
      currentLoad: metrics.activeRequests,
      isHealthy: metrics.isHealthy,
      lastFailureTime: metrics.lastFailureTime,
      totalRequests: metrics.requests.length,
      totalFailures: metrics.requests.filter(req => !req.success).length,
      lastResponseTime: metrics.responseTimes[metrics.responseTimes.length - 1]
    };
  }

  /**
   * Reset metrics for a server
   */
  resetMetrics(serverId: string): void {
    this.serverMetrics.delete(serverId);
    console.log(`[LoadBalancer] Reset metrics for server ${serverId}`);
    this.saveMetricsToStorage();
  }

  /**
   * Get all server health metrics
   */
  getAllServerHealth(): HealthMetrics[] {
    return Array.from(this.serverMetrics.keys()).map(serverId => 
      this.getServerHealth(serverId)
    );
  }

  /**
   * Update load balancing configuration
   */
  updateConfig(newConfig: Partial<LoadBalancingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`[LoadBalancer] Updated config:`, this.config);
  }

  private selectServerByStrategy(servers: string[], strategy: LoadBalancingStrategy): string {
    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(servers);
      
      case LoadBalancingStrategy.LEAST_LOADED:
        return this.selectLeastLoaded(servers);
      
      case LoadBalancingStrategy.FASTEST_RESPONSE:
        return this.selectFastestResponse(servers);
      
      case LoadBalancingStrategy.WEIGHTED:
        return this.selectWeighted(servers);
      
      default:
        return servers[0];
    }
  }

  private selectRoundRobin(servers: string[]): string {
    const key = servers.sort().join(',');
    const currentIndex = this.roundRobinCounters.get(key) || 0;
    const selectedServer = servers[currentIndex % servers.length];
    this.roundRobinCounters.set(key, currentIndex + 1);
    return selectedServer;
  }

  private selectLeastLoaded(servers: string[]): string {
    return servers.reduce((best, current) => {
      const bestHealth = this.getServerHealth(best);
      const currentHealth = this.getServerHealth(current);
      return currentHealth.currentLoad < bestHealth.currentLoad ? current : best;
    });
  }

  private selectFastestResponse(servers: string[]): string {
    return servers.reduce((best, current) => {
      const bestHealth = this.getServerHealth(best);
      const currentHealth = this.getServerHealth(current);
      
      // Prefer servers with response time data
      if (bestHealth.responseTimeAverage === 0 && currentHealth.responseTimeAverage > 0) {
        return current;
      }
      if (currentHealth.responseTimeAverage === 0 && bestHealth.responseTimeAverage > 0) {
        return best;
      }
      
      return currentHealth.responseTimeAverage < bestHealth.responseTimeAverage ? current : best;
    });
  }

  private selectWeighted(servers: string[]): string {
    // Calculate weighted scores based on success rate and response time
    const serverScores = servers.map(serverId => {
      const health = this.getServerHealth(serverId);
      
      // Score = (success_rate * 0.6) + (inverse_response_time * 0.3) + (inverse_load * 0.1)
      const successScore = health.successRate * 0.6;
      const responseScore = health.responseTimeAverage > 0 
        ? (1000 / health.responseTimeAverage) * 0.3 
        : 0.3; // Default score if no data
      const loadScore = health.currentLoad > 0 
        ? (1 / (health.currentLoad + 1)) * 0.1 
        : 0.1;
      
      const totalScore = successScore + responseScore + loadScore;
      
      return { serverId, score: totalScore };
    });
    
    // Select server with highest score
    const bestServer = serverScores.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return bestServer.serverId;
  }

  private ensureServerMetrics(serverId: string): void {
    if (!this.serverMetrics.has(serverId)) {
      this.serverMetrics.set(serverId, {
        serverId,
        responseTimes: [],
        requests: [],
        activeRequests: 0,
        isHealthy: true,
        consecutiveFailures: 0,
        roundRobinIndex: 0
      });
    }
  }

  private isServerHealthy(serverId: string): boolean {
    this.ensureServerMetrics(serverId);
    const metrics = this.serverMetrics.get(serverId)!;
    
    // Check if server should be recovered
    if (!metrics.isHealthy && this.shouldRecoverServer(serverId)) {
      metrics.isHealthy = true;
      metrics.consecutiveFailures = 0;
      console.log(`[LoadBalancer] Auto-recovered server ${serverId}`);
    }
    
    return metrics.isHealthy;
  }

  private shouldRecoverServer(serverId: string): boolean {
    const metrics = this.serverMetrics.get(serverId);
    if (!metrics || metrics.isHealthy) return false;
    
    const timeSinceFailure = Date.now() - (metrics.lastFailureTime || 0);
    return timeSinceFailure > this.config.unhealthyCooldownMs;
  }

  private async saveMetricsToStorage(): Promise<void> {
    try {
      const metricsData = Array.from(this.serverMetrics.entries()).map(([serverId, metrics]) => ({
        serverId,
        responseTimes: metrics.responseTimes.slice(-10), // Keep last 10 only
        recentRequests: metrics.requests.slice(-20), // Keep last 20 only
        isHealthy: metrics.isHealthy,
        lastFailureTime: metrics.lastFailureTime,
        consecutiveFailures: metrics.consecutiveFailures
      }));
      
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(metricsData));
    } catch (error) {
      console.warn('[LoadBalancer] Failed to save metrics to storage:', error);
    }
  }

  private async loadMetricsFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const metricsData = JSON.parse(stored);
        
        for (const data of metricsData) {
          this.serverMetrics.set(data.serverId, {
            serverId: data.serverId,
            responseTimes: data.responseTimes || [],
            requests: data.recentRequests || [],
            activeRequests: 0, // Reset active requests on startup
            isHealthy: data.isHealthy !== false, // Default to healthy
            lastFailureTime: data.lastFailureTime,
            consecutiveFailures: data.consecutiveFailures || 0,
            roundRobinIndex: 0
          });
        }
        
        console.log(`[LoadBalancer] Loaded metrics for ${metricsData.length} servers from storage`);
      }
    } catch (error) {
      console.warn('[LoadBalancer] Failed to load metrics from storage:', error);
    }
  }
}

// Singleton instance for global use
export const loadBalancer = new MCPLoadBalancer();