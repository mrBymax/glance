import { parseNativeToPage, type GlanceBridge, type NativeToPage, type PageToNative } from '@glance/shared';

/** The two members that the Android app and the page share on `window`. */
export type NativeHost = {
  GlanceNative?: { postMessage(json: string): void };
  __glanceReceive?: (json: string) => void;
};

declare global {
  // The members of NativeHost, so that `window` is a NativeHost.
  interface Window {
    GlanceNative?: { postMessage(json: string): void };
    __glanceReceive?: (json: string) => void;
  }
}

function parseMessage(json: string): NativeToPage | null {
  try {
    return parseNativeToPage(JSON.parse(json));
  } catch {
    // The app can be newer than the page. Text that is not JSON is dropped like an unknown message.
    return null;
  }
}

/** The bridge inside the WebView. The page must send `ui.ready` after it makes this bridge. */
export class AndroidBridge implements GlanceBridge {
  private readonly app: { postMessage(json: string): void };
  private readonly listeners = new Set<(message: NativeToPage) => void>();

  constructor(host: NativeHost) {
    if (!host.GlanceNative) throw new Error('window.GlanceNative is missing: this page is not in the Glance WebView');
    this.app = host.GlanceNative;
    host.__glanceReceive = (json) => {
      const message = parseMessage(json);
      if (!message) return;
      for (const listener of [...this.listeners]) listener(message);
    };
  }

  send(message: PageToNative): void {
    this.app.postMessage(JSON.stringify(message));
  }

  subscribe(listener: (message: NativeToPage) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
