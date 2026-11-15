type Listener = (message: unknown) => void;

/** Delivers messages inside this process. A topic with no listener drops its messages. */
export class EventBus {
  private readonly topics = new Map<string, Set<Listener>>();

  publish(topic: string, message: unknown): void {
    const listeners = this.topics.get(topic);
    if (!listeners) return;
    // The copy lets a listener unsubscribe during the delivery.
    for (const listener of [...listeners]) {
      try {
        listener(message);
      } catch (error) {
        // One client that fails must not stop the delivery to the others.
        console.error(`bus: a listener of ${topic} failed:`, error);
      }
    }
  }

  /** Returns the unsubscribe function. */
  subscribe(topic: string, listener: Listener): () => void {
    let listeners = this.topics.get(topic);
    if (!listeners) {
      listeners = new Set();
      this.topics.set(topic, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && this.topics.get(topic) === listeners) this.topics.delete(topic);
    };
  }
}

/** The topic that carries each ServerEvent of one session. */
export function sessionTopic(sessionId: string): string {
  return `session:${sessionId}`;
}

/** The topic that carries each KioskEvent of one kiosk. */
export function kioskTopic(kioskId: string): string {
  return `kiosk:${kioskId}`;
}
