"use client";

import { motion } from "framer-motion";
import type { MatchDecision } from "@/lib/types";

type MatchResultCardProps = {
  result: MatchDecision;
};

export default function MatchResultCard({ result }: MatchResultCardProps) {
  const exportDecisionJson = () => {
    const payload = JSON.stringify(result.decisionJson, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `match-${result.candidateUserId}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6 shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-amber-700">WEEKLY MATCH</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{result.candidateName}</h3>
          <p className="mt-1 text-sm text-slate-600">匿名邮箱：{result.maskedEmail}</p>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-xs tracking-[0.16em] text-slate-500">兼容度</p>
          <p className="text-3xl font-semibold text-teal-700">{result.compatibilityScore}%</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-700">{result.summary}</p>

      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {result.reason.map((item) => (
          <li key={item} className="rounded-xl bg-white px-3 py-2">
            {item}
          </li>
        ))}
      </ul>

      <section className="mt-5 rounded-2xl border border-amber-200 bg-white/75 p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500">AGENT ARENA</p>
        <p className="mt-2 text-sm text-slate-700">
          赛道：{result.arena.track} · 机制：{result.arena.lane}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Run ID：{result.arena.runId} · 回合：{result.arena.rounds} · 周期：
          {result.arena.cycleMinutes} 分钟
        </p>
        <p className="mt-2 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
          验证哈希: {result.arena.verificationHash}
        </p>
      </section>

      <button
        type="button"
        onClick={exportDecisionJson}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-800 transition hover:border-slate-700 hover:text-slate-900"
      >
        导出 Agent 决策 JSON
      </button>
    </motion.article>
  );
}
