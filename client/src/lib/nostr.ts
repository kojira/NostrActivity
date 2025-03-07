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

const defaultRelays = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];

export class NostrClient {
  private relayPool: RelayPool[] = [];

  constructor() {
    this.connectToRelays();
  }

  private connectToRelays() {
    defaultRelays.forEach(url => {
      const relay = new WebSocket(url);
      this.relayPool.push({ url, relay });
    });
  }

  private isValidPubkey(pubkey: string): boolean {
    try {
      if (pubkey.startsWith('npub')) {
        const { type, data } = nip19.decode(pubkey);
        return type === 'npub' && typeof data === 'string';
      }
      return /^[0-9a-fA-F]{64}$/.test(pubkey);
    } catch {
      return false;
    }
  }

  public normalizePubkey(pubkey: string): string {
    if (!this.isValidPubkey(pubkey)) {
      throw new Error('Invalid pubkey format');
    }

    if (pubkey.startsWith('npub')) {
      const { data } = nip19.decode(pubkey);
      return data as string;
    }
    return pubkey.toLowerCase();
  }

  public async getEvents(pubkey: string, startTime: number): Promise<NostrEvent[]> {
    const normalizedPubkey = this.normalizePubkey(pubkey);
    const events: NostrEvent[] = [];
    const BATCH_WINDOW = 30 * 24 * 60 * 60; // 30 days window
    let currentEndTime = Math.floor(Date.now() / 1000);
    let currentStartTime = startTime;
    let hasMoreEvents = true;
    let batchCount = 0;

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
        kinds: [1, 6, 7], // text_note, repost, reaction
      };

      const batchEvents = await this.fetchEventBatch(filter);
      events.push(...batchEvents);

      console.log(`[Nostr] Batch ${batchCount} completed: ${batchEvents.length} events`);

      if (batchEvents.length === 0) {
        hasMoreEvents = false;
        console.log('[Nostr] No more events found, stopping fetch');
      } else {
        currentStartTime = batchEndTime;
      }
    }

    console.log(`[Nostr] Total events fetched: ${events.length}`);
    return events;
  }

  private async fetchEventBatch(filter: any): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    const promises = this.relayPool.map(({ relay, url }) => {
      return new Promise<void>((resolve) => {
        const subId = Math.random().toString(36).substring(7);
        let receivedEose = false;
        let timeout: NodeJS.Timeout;
        let eventCount = 0;

        console.log(`[Nostr] Sending REQ to ${url}:`, filter);

        const resetTimeout = () => {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (!receivedEose) {
              console.log(`[Nostr] Timeout reached for ${url}, closing subscription ${subId}`);
              relay.send(JSON.stringify(["CLOSE", subId]));
              resolve();
            }
          }, 10000); // 10 seconds timeout for each batch
        };

        resetTimeout();

        relay.send(JSON.stringify(["REQ", subId, filter]));

        relay.onmessage = (event) => {
          const [type, _, eventData] = JSON.parse(event.data);
          if (type === 'EVENT') {
            eventCount++;
            resetTimeout();
            events.push(eventData);
          } else if (type === 'EOSE') {
            receivedEose = true;
            console.log(`[Nostr] Received EOSE from ${url} for subscription ${subId}`);
            console.log(`[Nostr] Events received from ${url}: ${eventCount}`);
            clearTimeout(timeout);
            relay.send(JSON.stringify(["CLOSE", subId]));
            resolve();
          }
        };
      });
    });

    await Promise.all(promises);
    return events;
  }
}

export const nostrClient = new NostrClient();