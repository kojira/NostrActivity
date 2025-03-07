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
    // 現在の日付を取得し、時刻を現地時間の00:00:00に設定
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 正確に1年前の日付を計算（現地時間）
    const startDate = new Date(now);
    startDate.setFullYear(now.getFullYear() - 1);

    // Create array of all days in the last year and initialize with 0
    const dayMap = new Map<string, number>();
    const eventsByDay = new Map<string, NostrEvent[]>();
    const days = d3.timeDays(startDate, now.getTime() + 86400000); // Include today

    days.forEach(day => {
      // 日付文字列を現地時間で生成
      const localDate = new Date(day);
      const dateKey = localDate.toLocaleDateString('sv'); // YYYY-MM-DD形式
      dayMap.set(dateKey, 0);
      eventsByDay.set(dateKey, []);
    });

    // イベントを日付でソート
    const sortedEvents = [...events].sort((a, b) => a.created_at - b.created_at);

    // Count events per day and store events
    sortedEvents.forEach(event => {
      // UTCタイムスタンプを現地時間のDateオブジェクトに変換
      const eventDate = new Date(event.created_at * 1000);
      const dateKey = eventDate.toLocaleDateString('sv');

      if (dayMap.has(dateKey)) {
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
        eventsByDay.get(dateKey)?.push(event);
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
    const normalized = count / maxCount;
    if (normalized <= 0.2) return 'bg-blue-200';
    if (normalized <= 0.4) return 'bg-blue-300';
    if (normalized <= 0.6) return 'bg-blue-400';
    if (normalized <= 0.8) return 'bg-blue-500';
    return 'bg-blue-600';
  };

  const weeks = useMemo(() => {
    const days = data.counts;
    const weekData: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    for (let i = 0; i < days.length; i++) {
      currentWeek.push(days[i]);
      if (currentWeek.length === 7) {
        weekData.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weekData.push(currentWeek);
    }

    return weekData;
  }, [data]);

  const handleDayClick = (day: { date: Date; count: number }) => {
    const dateKey = day.date.toLocaleDateString('sv');
    const dayEvents = data.eventsByDay.get(dateKey) || [];
    dayEvents.sort((a, b) => b.created_at - a.created_at); // 新しい順にソート
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
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay.date, 'yyyy年MM月dd日')}の活動
              {selectedDay && ` (${selectedDay.events.length}件)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {selectedDay?.events.map((event, index) => {
              const { type, details } = getEventDetails(event);
              return (
                <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm">{type}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(event.created_at * 1000), 'HH:mm:ss')}
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