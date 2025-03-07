import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NostrEvent } from '@/lib/nostr';
import { format } from 'date-fns';

interface ContributionGraphProps {
  events: NostrEvent[];
}

export function ContributionGraph({ events }: ContributionGraphProps) {
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    events: NostrEvent[];
  } | null>(null);

  const data = useMemo(() => {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Create array of all days in the last year and initialize with 0
    const dayMap = new Map<string, number>();
    const eventsByDay = new Map<string, NostrEvent[]>();
    const days = d3.timeDays(oneYearAgo, now);

    days.forEach(day => {
      const dateKey = day.toISOString().split('T')[0];
      dayMap.set(dateKey, 0);
      eventsByDay.set(dateKey, []);
    });

    // Count events per day and store events
    events.forEach(event => {
      const day = new Date(event.created_at * 1000).toISOString().split('T')[0];
      if (dayMap.has(day)) {
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
        eventsByDay.get(day)?.push(event);
      }
    });

    return {
      counts: Array.from(dayMap.entries()).map(([date, count]) => ({
        date: new Date(date),
        count
      })),
      eventsByDay
    };
  }, [events]);

  // Calculate maximum count for better color distribution
  const maxCount = useMemo(() => {
    return Math.max(...data.counts.map(d => d.count));
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
    const startDate = data.counts[0].date;
    const endDate = data.counts[data.counts.length - 1].date;

    // 日曜日から始まるように調整
    const adjustedStart = new Date(startDate);
    adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());

    // 土曜日で終わるように調整
    const adjustedEnd = new Date(endDate);
    adjustedEnd.setDate(adjustedEnd.getDate() + (6 - adjustedEnd.getDay()));

    const allDays = d3.timeDays(adjustedStart, adjustedEnd);

    // 7日ごとに週に分割
    const weekData: { date: Date; count: number }[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weekData.push(
        allDays.slice(i, i + 7).map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const dayData = data.counts.find(d =>
            d.date.toISOString().split('T')[0] === dateKey
          );
          return {
            date,
            count: dayData?.count || 0
          };
        })
      );
    }

    return weekData;
  }, [data]);

  const handleDayClick = (day: { date: Date; count: number }) => {
    const dateKey = day.date.toISOString().split('T')[0];
    const dayEvents = data.eventsByDay.get(dateKey) || [];
    setSelectedDay({
      date: day.date,
      events: dayEvents
    });
  };

  const getEventDetails = (event: NostrEvent): { type: string; details: string } => {
    const getTagValue = (tags: string[][], key: string): string | undefined => {
      return tags.find(tag => tag[0] === key)?.[1];
    };

    switch (event.kind) {
      case 1:
        return {
          type: 'テキスト投稿',
          details: event.content
        };
      case 6: {
        const noteId = getTagValue(event.tags, 'e');
        return {
          type: 'リポスト',
          details: noteId ? `リポストしたノート: ${noteId}` : 'ノートIDなし'
        };
      }
      case 7: {
        const noteId = getTagValue(event.tags, 'e');
        return {
          type: 'リアクション',
          details: `${event.content} (対象ノート: ${noteId || 'IDなし'})`
        };
      }
      default:
        return {
          type: 'その他のイベント',
          details: `種別: ${event.kind}`
        };
    }
  };

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
                  className={`w-3 h-3 rounded-sm ${getColor(day.count)} cursor-pointer hover:ring-2 hover:ring-primary transition-all`}
                  title={`${format(day.date, 'yyyy/MM/dd')}: ${day.count} contributions`}
                  onClick={() => handleDayClick(day)}
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

      <Dialog open={selectedDay !== null} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay.date, 'yyyy年MM月dd日')}の活動
              {selectedDay && ` (${selectedDay.events.length}件)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDay?.events.map((event, index) => {
              const { type, details } = getEventDetails(event);
              return (
                <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm">{type}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(event.created_at * 1000), 'yyyy/MM/dd HH:mm:ss')}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 break-words">{details}</div>
                </div>
              );
            })}
            {selectedDay?.events.length === 0 && (
              <div className="text-gray-500">この日の活動はありません</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}