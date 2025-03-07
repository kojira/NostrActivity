import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ContributionGraph } from '@/components/contribution-graph';
import { nostrClient } from '@/lib/nostr';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [pubkey, setPubkey] = useState('');
  const { toast } = useToast();

  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['nostr-events', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];
      try {
        const events = await nostrClient.getEvents(pubkey, oneYearAgo);
        toast({
          title: "Success",
          description: `取得したイベント数: ${events.length}件`,
        });
        return events;
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to fetch events",
          variant: "destructive"
        });
        throw err;
      }
    },
    enabled: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubkey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Nostr pubkey",
        variant: "destructive"
      });
      return;
    }
    refetch();
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
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : "View Activity"}
            </Button>
          </form>
        </Card>

        {error ? (
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="text-red-600">
              Failed to load events. Please check the pubkey and try again.
            </div>
          </Card>
        ) : events && events.length > 0 ? (
          <ContributionGraph events={events} />
        ) : events && (
          <Card className="p-6">
            <div className="text-gray-600 text-center">
              No activity found for this pubkey in the last year
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}