"use client";

import { useEffect, useMemo, useState } from "react";

function getNextMatchTime(now: Date) {
  const next = new Date(now);
  next.setHours(21, 0, 0, 0);

  const day = next.getDay();
  const daysUntilTuesday = (2 - day + 7) % 7;
  next.setDate(next.getDate() + daysUntilTuesday);

  if (daysUntilTuesday === 0 && now >= next) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export default function WeeklyCountdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const nextMatchTime = useMemo(() => getNextMatchTime(now), [now]);
  const remain = formatTime(nextMatchTime.getTime() - now.getTime());

  return (
    <div className="rounded-2xl border border-teal-200 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-teal-700">NEXT REVEAL</p>
      <p className="mt-2 text-sm text-slate-600">每周二 21:00 公布新一轮匹配</p>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center sm:gap-3">
        {[
          { label: "天", value: remain.days },
          { label: "时", value: remain.hours },
          { label: "分", value: remain.minutes },
          { label: "秒", value: remain.seconds },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-teal-50 px-2 py-3 text-slate-800"
          >
            <p className="text-xl font-semibold sm:text-2xl">{String(item.value).padStart(2, "0")}</p>
            <p className="mt-1 text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
