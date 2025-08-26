/**
 * MCP Transport Layer - HTTP and WebSocket implementations
 * Provides transport abstractions for MCP JSON-RPC 2.0 communication
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  MCPHttpConfig,
  MCPWebSocketConfig,
  MCPConnectionState,
  MCPErrorCode,
  MCPTransportConfig
} from './types';

export interface MCPTransport {
  readonly state: MCPConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  sendNotification(notification: JsonRpcNotification): Promise<void>;
  onNotification(callback: (notification: JsonRpcNotification) => void): void;
  onStateChange(callback: (state: MCPConnectionState) => void): void;
  onError(callback: (error: Error) => void): void;
}

/**
 * HTTP Transport for MCP servers using fetch API
 * Suitable for REST-based MCP servers
 */
export class MCPHttpTransport implements MCPTransport {
  private _state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private config: MCPHttpConfig;
  private stateCallbacks: Array<(state: MCPConnectionState) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private notificationCallbacks: Array<(notification: JsonRpcNotification) => void> = [];
  private requestId = 0;

  constructor(config: MCPHttpConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  get state(): MCPConnectionState {
    return this._state;
  }

  private setState(state: MCPConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.stateCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('State callback error:', error);
        }
      });
    }
  }

  private emitError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error callback error:', err);
      }
    });
  }

  async connect(): Promise<void> {
    this.setState(MCPConnectionState.CONNECTING);
    
    try {
      // For MCP servers, we skip the OPTIONS test and go directly to CONNECTED
      // The actual connection verification happens during the initialize request
      this.setState(MCPConnectionState.CONNECTED);
    } catch (error) {
      this.setState(MCPConnectionState.ERROR);
      const connectionError = new Error(`HTTP transport connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitError(connectionError);
      throw connectionError;
    }
  }

  async disconnect(): Promise<void> {
    this.setState(MCPConnectionState.DISCONNECTED);
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (this._state !== MCPConnectionState.CONNECTED && this._state !== MCPConnectionState.INITIALIZED) {
      throw new Error('Transport not connected');
    }

    // Assign ID if not present
    const requestWithId = {
      ...request,
      id: request.id || ++this.requestId
    };

    let lastError: Error | null = null;
    const attempts = this.config.retryAttempts || 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`MCP HTTP Request (attempt ${attempt}):`, {
          url: this.config.baseUrl,
          method: requestWithId.method,
          id: requestWithId.id
        });

        // Create React Native compatible abort controller with timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, this.config.timeout || 30000);

        const response = await fetch(this.config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          },
          body: JSON.stringify(requestWithId),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        console.log(`MCP HTTP Response:`, {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        });

        if (!response.ok) {
          // Try to get the response body for better error details
          let errorBody = '';
          try {
            errorBody = await response.text();
            console.log(`MCP HTTP Error Response Body:`, errorBody);
          } catch (bodyError) {
            console.log('Could not read error response body:', bodyError);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json') && !contentType?.includes('text/event-stream')) {
          throw new Error(`Invalid response content type: ${contentType}`);
        }

        let jsonResponse: JsonRpcResponse;
        
        if (contentType?.includes('text/event-stream')) {
          // Handle Server-Sent Events response
          const responseText = await response.text();
          console.log(`MCP SSE Response:`, responseText);
          
          // Parse SSE format - extract JSON from data: lines
          const lines = responseText.split('\n');
          const dataLines = lines.filter(line => line.startsWith('data: '));
          
          if (dataLines.length === 0) {
            throw new Error('No data found in SSE response');
          }
          
          // Get the last data line (most recent event)
          const lastDataLine = dataLines[dataLines.length - 1];
          const jsonString = lastDataLine.substring(6); // Remove 'data: ' prefix
          
          if (jsonString.trim() === '[DONE]' || jsonString.trim() === '') {
            throw new Error('SSE stream completed without JSON-RPC response');
          }
          
          try {
            jsonResponse = JSON.parse(jsonString);
          } catch (parseError) {
            throw new Error(`Failed to parse SSE JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        } else {
          // Handle regular JSON response
          jsonResponse = await response.json();
        }

        // Validate JSON-RPC response
        if (jsonResponse.jsonrpc !== '2.0') {
          throw new Error(`Invalid JSON-RPC version: ${jsonResponse.jsonrpc}`);
        }

        if (jsonResponse.id !== requestWithId.id) {
          throw new Error(`Response ID mismatch: expected ${requestWithId.id}, got ${jsonResponse.id}`);
        }

        return jsonResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < attempts) {
          console.warn(`HTTP request attempt ${attempt} failed, retrying:`, lastError.message);
          await this.delay(this.config.retryDelay || 1000);
        }
      }
    }

    // All attempts failed
    this.setState(MCPConnectionState.ERROR);
    const finalError = new Error(`HTTP request failed after ${attempts} attempts: ${lastError?.message}`);
    this.emitError(finalError);
    throw finalError;
  }

  async sendNotification(notification: JsonRpcNotification): Promise<void> {
    if (this._state !== MCPConnectionState.CONNECTED && this._state !== MCPConnectionState.INITIALIZED) {
      throw new Error('Transport not connected');
    }

    try {
      // Create React Native compatible abort controller with timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, this.config.timeout || 30000);

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(notification),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const notificationError = new Error(`Notification send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitError(notificationError);
      throw notificationError;
    }
  }

  onNotification(callback: (notification: JsonRpcNotification) => void): void {
    this.notificationCallbacks.push(callback);
  }

  onStateChange(callback: (state: MCPConnectionState) => void): void {
    this.stateCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * WebSocket Transport for MCP servers
 * Suitable for real-time MCP servers with bi-directional communication
 */
export class MCPWebSocketTransport implements MCPTransport {
  private _state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private config: MCPWebSocketConfig;
  private socket: WebSocket | null = null;
  private stateCallbacks: Array<(state: MCPConnectionState) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private notificationCallbacks: Array<(notification: JsonRpcNotification) => void> = [];
  private pendingRequests: Map<string | number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestId = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: MCPWebSocketConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      heartbeatInterval: 30000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 5,
      ...config
    };
  }

  get state(): MCPConnectionState {
    return this._state;
  }

  private setState(state: MCPConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.stateCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('State callback error:', error);
        }
      });
    }
  }

  private emitError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error callback error:', err);
      }
    });
  }

  async connect(): Promise<void> {
    if (this._state === MCPConnectionState.CONNECTED || this._state === MCPConnectionState.CONNECTING) {
      return;
    }

    this.setState(MCPConnectionState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.config.url, this.config.protocols);

        const connectTimeout = setTimeout(() => {
          if (this.socket?.readyState === WebSocket.CONNECTING) {
            this.socket.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.config.timeout || 30000);

        this.socket.onopen = () => {
          clearTimeout(connectTimeout);
          this.setState(MCPConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectTimeout);
          this.stopHeartbeat();
          this.setState(MCPConnectionState.DISCONNECTED);
          
          // Reject pending requests
          this.pendingRequests.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('WebSocket connection closed'));
          });
          this.pendingRequests.clear();

          if (event.code !== 1000 && this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        this.socket.onerror = (error) => {
          clearTimeout(connectTimeout);
          this.setState(MCPConnectionState.ERROR);
          const wsError = new Error(`WebSocket error: ${error}`);
          this.emitError(wsError);
          reject(wsError);
        };
      } catch (error) {
        this.setState(MCPConnectionState.ERROR);
        const connectionError = new Error(`WebSocket connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.emitError(connectionError);
        reject(connectionError);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'Client disconnect');
    }

    this.setState(MCPConnectionState.DISCONNECTED);
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (this._state !== MCPConnectionState.CONNECTED && this._state !== MCPConnectionState.INITIALIZED) {
      throw new Error('WebSocket not connected');
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not available');
    }

    // Assign ID if not present
    const requestWithId = {
      ...request,
      id: request.id || ++this.requestId
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestWithId.id!);
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(requestWithId.id!, { resolve, reject, timeout });

      try {
        this.socket!.send(JSON.stringify(requestWithId));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestWithId.id!);
        reject(new Error(`Failed to send request: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  async sendNotification(notification: JsonRpcNotification): Promise<void> {
    if (this._state !== MCPConnectionState.CONNECTED && this._state !== MCPConnectionState.INITIALIZED) {
      throw new Error('WebSocket not connected');
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not available');
    }

    try {
      this.socket.send(JSON.stringify(notification));
    } catch (error) {
      throw new Error(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onNotification(callback: (notification: JsonRpcNotification) => void): void {
    this.notificationCallbacks.push(callback);
  }

  onStateChange(callback: (state: MCPConnectionState) => void): void {
    this.stateCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle response
      if (message.jsonrpc === '2.0' && (message.result !== undefined || message.error !== undefined)) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message as JsonRpcResponse);
        }
        return;
      }

      // Handle notification
      if (message.jsonrpc === '2.0' && message.method && message.id === undefined) {
        this.notificationCallbacks.forEach(callback => {
          try {
            callback(message as JsonRpcNotification);
          } catch (error) {
            console.error('Notification callback error:', error);
          }
        });
        return;
      }

      console.warn('Received invalid JSON-RPC message:', message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval && this.config.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          // Send ping frame or keepalive message
          this.socket.ping?.();
        }
      }, this.config.heartbeatInterval);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.setState(MCPConnectionState.RECONNECTING);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.scheduleReconnect();
      }
    }, this.config.reconnectDelay || 5000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/**
 * Transport factory for creating appropriate transport instances
 */
export class MCPTransportFactory {
  static create(type: 'http', config: MCPHttpConfig): MCPHttpTransport;
  static create(type: 'websocket', config: MCPWebSocketConfig): MCPWebSocketTransport;
  static create(type: 'http' | 'websocket', config: MCPHttpConfig | MCPWebSocketConfig): MCPTransport {
    switch (type) {
      case 'http':
        return new MCPHttpTransport(config as MCPHttpConfig);
      case 'websocket':
        return new MCPWebSocketTransport(config as MCPWebSocketConfig);
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}