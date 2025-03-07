import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ContributionGraph } from '@/components/contribution-graph';
import { nostrClient, type NostrEvent, type FetchProgress } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [pubkey, setPubkey] = useState('');
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const { toast } = useToast();

  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

  const fetchEvents = async () => {
    if (!pubkey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Nostr pubkey",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);

    try {
      const fetchedEvents = await nostrClient.getEvents(pubkey, oneYearAgo, (progress) => {
        setProgress(progress);
        // 現在までに取得したイベントを更新
        setEvents(prevEvents => [...prevEvents]);
      });
      setEvents(fetchedEvents);
      toast({
        title: "Success",
        description: `取得したイベント数: ${fetchedEvents.length}件`,
      });
    } catch (err) {
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
          <form onSubmit={handleSubmit} className="flex gap-4">
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
              Failed to load events. Please check the pubkey and try again.
            </div>
          </Card>
        ) : events.length > 0 ? (
          <ContributionGraph events={events} />
        ) : null}
      </div>
    </div>
  );
}