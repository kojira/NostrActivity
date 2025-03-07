import { nip19 } from 'nostr-tools';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface RelayPool {
  url: string;
  relay: WebSocket;
}

export interface FetchProgress {
  currentBatch: number;
  totalBatches: number;
  fetchedEvents: number;
  startDate: string;
  endDate: string;
}

export class NostrClient {
  private relayPool: RelayPool[] = [];

  constructor(relayUrl: string = 'wss://yabu.me') {
    this.connectToRelay(relayUrl);
  }

  public async connectToRelay(url: string) {
    // 既存の接続が有効な場合は再利用
    const existingRelay = this.relayPool.find(r => r.url === url);
    if (existingRelay && existingRelay.relay.readyState === WebSocket.OPEN) {
      console.log(`[Nostr] Using existing connection to ${url}`);
      return;
    }

    // 既存の接続を閉じる
    this.relayPool.forEach(({ relay }) => {
      if (relay.readyState === WebSocket.OPEN) {
        relay.close();
      }
    });
    this.relayPool = [];

    console.log(`[Nostr] Connecting to relay: ${url}`);

    // WebSocket接続が確立されるまで待機
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout to ${url}`));
      }, 10000); // タイムアウトを10秒に延長

      const relay = new WebSocket(url);

      relay.onopen = () => {
        clearTimeout(timeout);
        console.log(`[Nostr] Connected to relay: ${url}`);
        this.relayPool.push({ url, relay });
        resolve();
      };

      relay.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${url}`));
      };
    });
  }

  private isValidPubkey(pubkey: string): boolean {
    try {
      console.log(`[Nostr] Validating pubkey: ${pubkey}`);
      if (pubkey.startsWith('npub')) {
        const { type, data } = nip19.decode(pubkey);
        console.log(`[Nostr] Decoded npub - type: ${type}, data: ${data}`);
        return type === 'npub' && typeof data === 'string';
      }
      const isHex = /^[0-9a-fA-F]{64}$/.test(pubkey);
      console.log(`[Nostr] Hex validation result: ${isHex}`);
      return isHex;
    } catch (error) {
      console.error('[Nostr] Pubkey validation error:', error);
      return false;
    }
  }

  public normalizePubkey(pubkey: string): string {
    if (!this.isValidPubkey(pubkey)) {
      throw new Error(`Invalid pubkey format: ${pubkey}. Please provide a valid hex (64 characters) or npub format.`);
    }

    if (pubkey.startsWith('npub')) {
      const { data } = nip19.decode(pubkey);
      return data as string;
    }
    return pubkey.toLowerCase();
  }

  public async getEvents(
    pubkey: string,
    startTime: number,
    onProgress?: (progress: FetchProgress, partialEvents: NostrEvent[]) => void
  ): Promise<NostrEvent[]> {
    const normalizedPubkey = this.normalizePubkey(pubkey);
    const events: NostrEvent[] = [];
    const BATCH_WINDOW = 24 * 60 * 60; // 1日単位で取得
    let currentEndTime = Math.floor(Date.now() / 1000);
    let currentStartTime = startTime;
    let hasMoreEvents = true;
    let batchCount = 0;

    // 総バッチ数を計算
    const totalBatches = Math.ceil((currentEndTime - startTime) / BATCH_WINDOW);

    console.log(`[Nostr] Starting event fetch for pubkey: ${normalizedPubkey}`);
    console.log(`[Nostr] Time range: ${new Date(startTime * 1000).toISOString()} - ${new Date(currentEndTime * 1000).toISOString()}`);

    while (hasMoreEvents && currentStartTime < currentEndTime) {
      const batchEndTime = Math.min(currentStartTime + BATCH_WINDOW, currentEndTime);
      batchCount++;

      console.log(`[Nostr] Fetching batch ${batchCount}:`);
      console.log(`[Nostr] From: ${new Date(currentStartTime * 1000).toISOString()}`);
      console.log(`[Nostr] To: ${new Date(batchEndTime * 1000).toISOString()}`);

      const filter = {
        authors: [normalizedPubkey],
        since: currentStartTime,
        until: batchEndTime,
      };

      try {
        const batchEvents = await this.fetchEventBatch(filter);
        events.push(...batchEvents);

        if (onProgress) {
          onProgress({
            currentBatch: batchCount,
            totalBatches,
            fetchedEvents: events.length,
            startDate: new Date(currentStartTime * 1000).toISOString(),
            endDate: new Date(batchEndTime * 1000).toISOString(),
          }, [...events]); // 現在までに取得したイベントの配列のコピーを渡す
        }

        console.log(`[Nostr] Batch ${batchCount} completed: ${batchEvents.length} events`);

        if (batchEvents.length === 0) {
          hasMoreEvents = false;
          console.log('[Nostr] No more events found, stopping fetch');
        } else {
          currentStartTime = batchEndTime;
        }
      } catch (error) {
        console.error(`[Nostr] Error fetching batch ${batchCount}:`, error);
        // エラーが発生しても次のバッチを続行
        currentStartTime = batchEndTime;
      }
    }

    console.log(`[Nostr] Total events fetched: ${events.length}`);
    return events;
  }

  private async fetchEventBatch(filter: any): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];

    if (this.relayPool.length === 0) {
      throw new Error('No relay connected');
    }

    const { relay, url } = this.relayPool[0];
    if (relay.readyState !== WebSocket.OPEN) {
      throw new Error(`Relay not connected: ${url}`);
    }

    return new Promise((resolve, reject) => {
      const subId = Math.random().toString(36).substring(7);
      let receivedEose = false;
      let timeout: NodeJS.Timeout;
      let eventCount = 0;

      console.log(`[Nostr] Sending REQ to ${url}:`, filter);

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        relay.onmessage = null;
      };

      const resetTimeout = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (!receivedEose) {
            console.log(`[Nostr] Timeout reached for ${url}, closing subscription ${subId}`);
            cleanup();
            relay.send(JSON.stringify(["CLOSE", subId]));
            resolve(events);
          }
        }, 10000);
      };

      resetTimeout();

      relay.onmessage = (event) => {
        try {
          const [type, _, eventData] = JSON.parse(event.data);
          if (type === 'EVENT') {
            eventCount++;
            resetTimeout();
            events.push(eventData);
          } else if (type === 'EOSE') {
            receivedEose = true;
            console.log(`[Nostr] Received EOSE from ${url} for subscription ${subId}`);
            console.log(`[Nostr] Events received from ${url}: ${eventCount}`);
            cleanup();
            relay.send(JSON.stringify(["CLOSE", subId]));
            resolve(events);
          }
        } catch (error) {
          console.error(`[Nostr] Error processing message from ${url}:`, error);
          cleanup();
          reject(error);
        }
      };

      relay.send(JSON.stringify(["REQ", subId, filter]));
    });
  }
}

export const nostrClient = new NostrClient();