import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import type { CityEvent } from '@molt-city/shared';

export type EventListener = (event: CityEvent) => void;

export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly publisher?: Redis;
  private readonly subscriber?: Redis;
  private readonly channel = 'molt-city:events';

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.publisher = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.subscriber = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      void this.publisher.connect().catch(() => undefined);
      void this.subscriber.connect().then(() => this.subscriber?.subscribe(this.channel)).catch(() => undefined);
      this.subscriber.on('message', (_channel, message) => {
        try {
          this.emitter.emit('event', JSON.parse(message) as CityEvent);
        } catch {
          // Ignore malformed fan-out messages.
        }
      });
    }
  }

  async publish(event: CityEvent): Promise<void> {
    this.emitter.emit('event', event);
    if (this.publisher?.status === 'ready') {
      await this.publisher.publish(this.channel, JSON.stringify(event)).catch(() => undefined);
    }
  }

  subscribe(listener: EventListener): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  async close(): Promise<void> {
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }
}
