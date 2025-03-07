import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ContributionGraph } from '@/components/contribution-graph';
import { nostrClient, type NostrEvent, type FetchProgress } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [pubkey, setPubkey] = useState('');
  const [relayUrl, setRelayUrl] = useState('wss://yabu.me');
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const { toast } = useToast();

  // 現在の日付を取得し、UTC基準の終了時刻を設定
  const now = new Date();
  const endTime = new Date(now);
  endTime.setUTCHours(23, 59, 59, 999);

  // 正確に1年前の日付を計算し、UTC基準の開始時刻を設定
  const startTime = new Date(now);
  startTime.setFullYear(now.getFullYear() - 1);
  startTime.setUTCHours(0, 0, 0, 0);

  const fetchEvents = async () => {
    if (!pubkey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Nostr pubkey",
        variant: "destructive"
      });
      return;
    }

    if (!relayUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a relay URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);

    try {
      // リレーの接続を更新
      await nostrClient.connectToRelay(relayUrl);

      console.log('[Home] Starting event fetch for pubkey:', pubkey);
      const fetchedEvents = await nostrClient.getEvents(
        pubkey,
        Math.floor(startTime.getTime() / 1000),
        Math.floor(endTime.getTime() / 1000),
        (progress, partialEvents) => {
          setProgress(progress);
          // 部分的に取得したイベントで更新
          setEvents(partialEvents);
        }
      );
      setEvents(fetchedEvents);
      console.log('[Home] Event fetch completed. Total events:', fetchedEvents.length);
      toast({
        title: "Success",
        description: `取得したイベント数: ${fetchedEvents.length}件`,
      });
    } catch (err) {
      console.error('[Home] Error fetching events:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch events",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Nostr Contribution Graph
          </h1>
          <p className="text-gray-600">
            View your Nostr activity over the last year
          </p>
        </div>

        <Card className="mb-8 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <Input
                value={relayUrl}
                onChange={(e) => setRelayUrl(e.target.value)}
                placeholder="Enter relay URL (e.g., wss://yabu.me)"
                className="flex-1"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-4">
              <Input
                value={pubkey}
                onChange={(e) => setPubkey(e.target.value)}
                placeholder="Enter Nostr pubkey (hex or npub)"
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Loading..." : "View Activity"}
              </Button>
            </div>
          </form>

          {progress && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Fetching events ({progress.currentBatch} / {progress.totalBatches} days)</span>
                <span>{progress.fetchedEvents} events</span>
              </div>
              <Progress value={(progress.currentBatch / progress.totalBatches) * 100} />
              <div className="text-xs text-gray-400">
                {new Date(progress.startDate).toLocaleDateString()} - {new Date(progress.endDate).toLocaleDateString()}
              </div>
            </div>
          )}
        </Card>

        {error ? (
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="text-red-600">
              {error.message}
            </div>
          </Card>
        ) : events.length > 0 ? (
          <ContributionGraph events={events} />
        ) : null}
      </div>
    </div>
  );
}