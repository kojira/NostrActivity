import { useMemo } from 'react';
import * as d3 from 'd3';
import { Card } from '@/components/ui/card';
import { NostrEvent } from '@/lib/nostr';

interface ContributionGraphProps {
  events: NostrEvent[];
}

export function ContributionGraph({ events }: ContributionGraphProps) {
  const data = useMemo(() => {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Create array of all days in the last year and initialize with 0
    const dayMap = new Map<string, number>();
    const days = d3.timeDays(oneYearAgo, now);
    days.forEach(day => {
      dayMap.set(day.toISOString().split('T')[0], 0);
    });

    // Count events per day
    events.forEach(event => {
      const day = new Date(event.created_at * 1000).toISOString().split('T')[0];
      if (dayMap.has(day)) {
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
    });

    // Convert to array format
    return Array.from(dayMap.entries()).map(([date, count]) => ({
      date: new Date(date),
      count
    }));
  }, [events]);

  // Calculate maximum count for better color distribution
  const maxCount = useMemo(() => {
    return Math.max(...data.map(d => d.count));
  }, [data]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';

    // 最大値に基づいて相対的な色の濃さを決定
    const normalized = count / maxCount;

    if (normalized <= 0.2) return 'bg-blue-200';
    if (normalized <= 0.4) return 'bg-blue-300';
    if (normalized <= 0.6) return 'bg-blue-400';
    if (normalized <= 0.8) return 'bg-blue-500';
    return 'bg-blue-600';
  };

  const weeks = useMemo(() => {
    const weekData: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    data.forEach((day, i) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || i === data.length - 1) {
        weekData.push(currentWeek);
        currentWeek = [];
      }
    });

    return weekData;
  }, [data]);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-500 mb-2">Contributions in the last year</div>
        <div className="flex gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
                  title={`${day.date.toLocaleDateString()}: ${day.count} contributions`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-blue-200" />
            <div className="w-3 h-3 rounded-sm bg-blue-300" />
            <div className="w-3 h-3 rounded-sm bg-blue-400" />
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <div className="w-3 h-3 rounded-sm bg-blue-600" />
          </div>
          <span>More</span>
        </div>
      </div>
    </Card>
  );
}