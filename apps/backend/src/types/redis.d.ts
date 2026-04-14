// ambient declaration for redis library when no typings are installed
// this ensures TypeScript knows the module exists and provides the necessary types

declare module 'redis' {
  export interface RedisError extends Error {
    code?: string;
  }

  export interface RedisClientOptions {
    url?: string;
    socket?: {
      reconnectStrategy?: (retries: number) => number | Error;
    };
  }

  export interface RedisClientType {
    connect(): Promise<void>;
    quit(): Promise<void>;
    isOpen: boolean;
    on(event: 'error', handler: (err: RedisError | undefined) => void): void;
    on(event: 'connect' | 'disconnect', handler: () => void): void;
  }

  export function createClient(options?: RedisClientOptions): RedisClientType;
  export { RedisError };
}
