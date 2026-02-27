"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MatchResultCard from "@/components/MatchResultCard";
import type { MatchDecision, QuestionnaireAnswers } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function MatchPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [result, setResult] = useState<MatchDecision | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoadingPage(false);
      return;
    }

    let alive = true;

    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!alive) {
        return;
      }

      if (!user) {
        router.push("/auth");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("questionnaires")
        .select("answers")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alive) {
        return;
      }

      if (error) {
        setStatus(`读取问卷失败：${error.message}`);
      }

      if (!data?.answers || typeof data.answers !== "object") {
        router.push("/questionnaire");
        return;
      }

      setAnswers(data.answers as QuestionnaireAnswers);
      setLoadingPage(false);
    };

    boot().catch((error) => {
      setLoadingPage(false);
      const message = error instanceof Error ? error.message : "初始化匹配页失败。";
      setStatus(message);
    });

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  const streamArenaLogs = async (logs: string[]) => {
    setThinkingText("");

    for (const line of logs) {
      setThinkingText((previous) =>
        previous.length > 0 ? `${previous}\n${line}` : line,
      );
      await sleep(680);
    }
  };

  const handleRunMatch = async () => {
    if (!userId || !answers) {
      setStatus("尚未完成问卷，请先返回问卷页填写。");
      return;
    }

    setRunningMatch(true);
    setStatus("");
    setResult(null);
    setThinkingText("");

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
          answers,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "匹配请求失败");
      }

      const nextResult = payload.result as MatchDecision;
      const logs =
        nextResult.arena?.logs && nextResult.arena.logs.length > 0
          ? nextResult.arena.logs
          : (payload.thoughtProcess as string | undefined)?.split("\n") ?? [
              "正在分析你的关系画像...",
            ];

      await streamArenaLogs(logs);
      setResult(nextResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "匹配失败，请稍后重试。";
      setStatus(message);
    } finally {
      setRunningMatch(false);
    }
  };

  if (!configured) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-16 sm:px-8">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">尚未配置 Supabase</p>
          <p className="mt-2 leading-7">
            当前无法读取问卷数据。请先配置 `.env.local` 并完成登录。
          </p>
        </article>
      </main>
    );
  }

  if (loadingPage) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-16 sm:px-8">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          正在加载匹配数据...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">本周匹配</h1>
          <p className="mt-2 text-sm text-slate-600">
            赛道3模式：3 个智能体竞赛 + 3 轮共识裁决 + 可验证哈希证据。
          </p>
        </div>

        <div className="flex gap-3 text-sm">
          <Link href="/questionnaire" className="text-slate-700 underline-offset-4 hover:underline">
            修改问卷
          </Link>
          <Link href="/" className="text-slate-700 underline-offset-4 hover:underline">
            回首页
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <button
          type="button"
          onClick={handleRunMatch}
          disabled={runningMatch}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {runningMatch ? "多智能体竞赛中..." : "启动 3-Agent 对战匹配（5分钟轮次仿真）"}
        </button>

        {runningMatch ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-3"
          >
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="h-full rounded-full bg-teal-700"
                initial={{ width: "0%" }}
                animate={{ width: ["0%", "65%", "100%"] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="text-sm text-slate-600">正在进行 Round 1~3 智能体竞赛与共识裁决...</p>
          </motion.div>
        ) : null}
      </div>

      {thinkingText ? (
        <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">
            AGENT ARENA STREAM
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{thinkingText}</p>
        </article>
      ) : null}

      {result ? (
        <div className="mt-6">
          <MatchResultCard result={result} />
        </div>
      ) : null}

      {status ? (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {status}
        </p>
      ) : null}
    </main>
  );
}
