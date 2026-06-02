/**
 * ShipFast Logs — AI-powered error monitoring SDK
 * 
 * Install: npm install shipfast-logs
 * Usage:   const logs = new ShipFastLogs('YOUR_API_KEY');
 */

export interface LogOptions {
  endpoint?: string;  // Custom API endpoint
  flushInterval?: number;  // ms between flushes (default: 5000)
  maxBatchSize?: number;  // Max errors per batch (default: 10)
  metadata?: Record<string, any>;  // Global metadata to attach to all errors
}

export interface CapturedError {
  type: string;
  message: string;
  stack?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ShipFastLogs {
  private apiKey: string;
  private endpoint: string;
  private flushInterval: number;
  private maxBatchSize: number;
  private globalMetadata: Record<string, any>;
  private buffer: CapturedError[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(apiKey: string, options: LogOptions = {}) {
    if (!apiKey || apiKey.length < 16) {
      throw new Error('Invalid API key. Please provide a valid ShipFast Logs API key.');
    }

    this.apiKey = apiKey;
    this.endpoint = options.endpoint || 'https://shipfastlogs.dev/api/v1/errors';
    this.flushInterval = options.flushInterval || 5000;
    this.maxBatchSize = options.maxBatchSize || 10;
    this.globalMetadata = options.metadata || {};

    // Auto-start flush timer
    this.startFlushTimer();

    // Graceful shutdown
    process.on('exit', () => this.flushSync());
    process.on('SIGINT', () => { this.isShuttingDown = true; this.flushSync(); process.exit(0); });
    process.on('SIGTERM', () => { this.isShuttingDown = true; this.flushSync(); process.exit(0); });
  }

  /**
   * Capture an error manually
   */
  capture(error: Error | string, metadata?: Record<string, any>): void {
    const err = typeof error === 'string' 
      ? new Error(error) 
      : error;

    this.buffer.push({
      type: err.name || 'Error',
      message: err.message || String(error),
      stack: err.stack,
      timestamp: new Date(),
      metadata: { ...this.globalMetadata, ...metadata }
    });

    // Flush immediately if buffer is full
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush().catch(err => console.warn('[ShipFastLogs] Flush failed:', err.message));
    }
  }

  /**
   * Express middleware — auto-captures unhandled errors
   */
  get express() {
    return (err: Error, req: any, res: any, next: any) => {
      this.capture(err, {
        method: req.method,
        url: req.url,
        headers: req.headers,
        ip: req.ip,
        body: req.body,
        user: req.user?.id || req.user?.email || null,
      });
      next(err);
    };
  }

  /**
   * Flush buffer to server
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const errors = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ errors }),
      });

      if (!response.ok) {
        // Put errors back in buffer on failure
        this.buffer.unshift(...errors);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      console.warn(`[ShipFastLogs] Failed to send errors (will retry): ${err.message}`);
      // Re-add errors to front of buffer for retry
      this.buffer.unshift(...errors);
    }
  }

  /**
   * Synchronous flush for shutdown
   */
  private flushSync(): void {
    if (this.buffer.length === 0) return;
    // Note: can't actually do sync fetch, just log
    console.log(`[ShipFastLogs] Flushing ${this.buffer.length} errors on shutdown...`);
    // In production you'd use a sync queue or write to disk here
    this.buffer = [];
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flush().catch(err => console.warn('[ShipFastLogs] Auto-flush failed:', err.message));
      }
    }, this.flushInterval);
  }
}

// Express integration helper
export function createExpressMiddleware(apiKey: string, options?: LogOptions) {
  const logger = new ShipFastLogs(apiKey, options);
  return logger.express;
}

export default ShipFastLogs;