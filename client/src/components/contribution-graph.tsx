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
    
    // Create array of all days in the last year
    const days = d3.timeDays(oneYearAgo, now);
    
    // Count events per day
    const eventsByDay = new Map<string, number>();
    days.forEach(day => {
      eventsByDay.set(day.toISOString().split('T')[0], 0);
    });
    
    events.forEach(event => {
      const day = new Date(event.created_at * 1000).toISOString().split('T')[0];
      if (eventsByDay.has(day)) {
        eventsByDay.set(day, (eventsByDay.get(day) || 0) + 1);
      }
    });
    
    return Array.from(eventsByDay.entries()).map(([date, count]) => ({
      date: new Date(date),
      count
    }));
  }, [events]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 2) return 'bg-blue-200';
    if (count <= 5) return 'bg-blue-300';
    if (count <= 10) return 'bg-blue-400';
    return 'bg-blue-500';
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
          </div>
          <span>More</span>
        </div>
      </div>
    </Card>
  );
}
