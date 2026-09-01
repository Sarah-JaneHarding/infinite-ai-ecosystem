'use client';

import { useState } from 'react';

interface Period {
  number: string;
  time: string;
  isBreak: boolean;
}

// BPP standard period structure — Mon–Thu (14 slots) and Fri (14 slots, slightly shorter)
const MON_THU: Period[] = [
  { number: 'Reg', time: '7:20–7:40', isBreak: false },
  { number: '1', time: '7:40–8:10', isBreak: false },
  { number: '2', time: '8:10–8:40', isBreak: false },
  { number: '3', time: '8:40–9:10', isBreak: false },
  { number: '4', time: '9:10–9:40', isBreak: false },
  { number: 'BREAK', time: '9:40–10:10', isBreak: true },
  { number: '5', time: '10:10–10:35', isBreak: false },
  { number: '6', time: '10:35–11:00', isBreak: false },
  { number: '7', time: '11:00–11:25', isBreak: false },
  { number: '8', time: '11:25–11:50', isBreak: false },
  { number: '9', time: '11:50–12:20', isBreak: false },
  { number: 'BREAK', time: '12:20–12:50', isBreak: true },
  { number: '10', time: '12:50–13:20', isBreak: false },
  { number: '11', time: '13:20–13:50', isBreak: false },
];

const FRIDAY: Period[] = [
  { number: 'Reg', time: '7:20–7:30', isBreak: false },
  { number: '1', time: '7:30–8:00', isBreak: false },
  { number: '2', time: '8:00–8:30', isBreak: false },
  { number: '3', time: '8:30–9:00', isBreak: false },
  { number: '4', time: '9:00–9:30', isBreak: false },
  { number: 'BREAK', time: '9:30–10:00', isBreak: true },
  { number: '5', time: '10:00–10:25', isBreak: false },
  { number: '6', time: '10:25–10:50', isBreak: false },
  { number: '7', time: '10:50–11:15', isBreak: false },
  { number: '8', time: '11:15–11:40', isBreak: false },
  { number: '9', time: '11:40–12:10', isBreak: false },
  { number: 'BREAK', time: '12:10–12:40', isBreak: true },
  { number: '10', time: '12:40–13:10', isBreak: false },
  { number: '11', time: '13:10–13:40', isBreak: false },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
type Day = (typeof DAYS)[number];

interface DaySchedule {
  day: Day;
  slots: Record<string, string>; // period number → subject/activity
}

interface DailyScheduleViewProps {
  grade: string;
  week: number;
  term: number;
  schedules?: DaySchedule[];
}

export function DailyScheduleView({
  grade,
  week,
  term,
  schedules = [],
}: DailyScheduleViewProps) {
  const [activeDay, setActiveDay] = useState<Day>('Monday');

  const periods = activeDay === 'Friday' ? FRIDAY : MON_THU;
  const schedule = schedules.find((s) => s.day === activeDay) ?? {
    day: activeDay,
    slots: {},
  };

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)]">
          MOD-01 · Daily BPP Schedule
        </p>
        <h2
          className="text-xl font-bold text-[var(--iai-text)]"
          style={{ fontFamily: 'var(--iai-font-title)' }}
        >
          {grade} — Term {term}, Week {week}
        </h2>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Day selector">
        {DAYS.map((day) => (
          <button
            key={day}
            role="tab"
            aria-selected={activeDay === day}
            onClick={() => setActiveDay(day)}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              activeDay === day
                ? 'bg-[var(--iai-accent)] text-white'
                : 'bg-[var(--iai-surface-raised)] text-[var(--iai-text)] hover:bg-[var(--iai-border)]',
            ].join(' ')}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Schedule table */}
      <div
        role="tabpanel"
        className="border border-[var(--iai-border)] rounded-xl overflow-hidden"
      >
        <div className="bg-[var(--iai-accent)] text-white px-4 py-2 text-sm font-semibold">
          {activeDay} · {grade}
        </div>
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="bg-[var(--iai-surface-raised)] border-b border-[var(--iai-border)]">
              <th
                scope="col"
                className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)] w-16"
              >
                Period
              </th>
              <th
                scope="col"
                className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)] w-28"
              >
                Time
              </th>
              <th
                scope="col"
                className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)]"
              >
                Subject / Activity
              </th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr
                key={i}
                className={[
                  'border-b border-[var(--iai-border)]',
                  p.isBreak
                    ? 'bg-[var(--iai-surface-raised)] text-[var(--iai-text-subtle)] italic'
                    : 'hover:bg-[var(--iai-surface-raised)]',
                ].join(' ')}
              >
                <td className="px-3 py-2 font-mono text-xs font-bold">{p.number}</td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--iai-text-subtle)]">
                  {p.time}
                </td>
                <td className="px-3 py-2">
                  {p.isBreak ? (
                    <span className="text-xs">Break</span>
                  ) : (
                    <span className="text-[var(--iai-text)]">
                      {schedule.slots[p.number] || (
                        <span className="text-[var(--iai-border)] italic text-xs">—</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
