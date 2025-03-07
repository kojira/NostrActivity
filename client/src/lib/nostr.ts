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
    const filter = {
      authors: [normalizedPubkey],
      since: startTime,
      kinds: [1, 6, 7], // text_note, repost, reaction
    };

    const events: NostrEvent[] = [];
    const promises = this.relayPool.map(({ relay }) => {
      return new Promise<void>((resolve) => {
        const subId = Math.random().toString(36).substring(7);
        
        relay.send(JSON.stringify(["REQ", subId, filter]));
        
        const timeout = setTimeout(() => {
          relay.send(JSON.stringify(["CLOSE", subId]));
          resolve();
        }, 5000);

        relay.onmessage = (event) => {
          const [type, _, eventData] = JSON.parse(event.data);
          if (type === 'EVENT') {
            events.push(eventData);
          } else if (type === 'EOSE') {
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
