import { minutesToTime, timeToMinutes, weekdayOf } from "@/lib/time";

type ScheduleLike = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
};

export function generateSlots(schedules: ScheduleLike[], day: string): string[] {
  const weekday = weekdayOf(day);
  const slots: string[] = [];

  for (const schedule of schedules) {
    if (!schedule.isActive || schedule.dayOfWeek !== weekday) continue;
    const start = timeToMinutes(schedule.startTime);
    const end = timeToMinutes(schedule.endTime);
    const step = Math.max(schedule.slotMinutes || 15, 5);

    for (let cursor = start; cursor + step <= end; cursor += step) {
      slots.push(minutesToTime(cursor));
    }
  }

  return Array.from(new Set(slots)).sort();
}

export function scheduleLabel(startTime: string, endTime: string) {
  return `${startTime} – ${endTime}`;
}
