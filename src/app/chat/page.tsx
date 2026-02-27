"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MatchDecision, QuestionnaireAnswers } from "@/lib/types";

type ChatMode = "user_to_partner" | "agent_to_agent";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentTranscript = {
  id: string;
  speaker: string;
  text: string;
};

type MatchContext = {
  userEmail: string;
  userAnswers: QuestionnaireAnswers;
  result: MatchDecision;
  storedAt: string;
};

export default function ChatPage() {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [mode, setMode] = useState<ChatMode>("user_to_partner");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<AgentTranscript[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem("yueagent:last-match-context");

    if (!raw) {
      setStatus("未找到匹配上下文，请先在匹配页完成一次匹配。");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as MatchContext;
      setContext(parsed);
      setMessages([
        {
          role: "assistant",
          content: `${parsed.result.candidateName}的Agent已上线。你可以先问：我们在关系节奏上怎么对齐？`,
        },
      ]);
    } catch {
      setStatus("匹配上下文损坏，请回到匹配页重新生成。\n");
    }
  }, []);

  const candidateName = context?.result.candidateName ?? "对方";

  const canChat = useMemo(
    () => Boolean(context?.result?.partnerProfile && context?.userAnswers),
    [context],
  );

  const sendUserMessage = async () => {
    if (!context || !input.trim()) {
      return;
    }

    setLoading(true);
    setStatus("");

    const nextMessages = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "user_to_partner",
          candidateName,
          userProfile: context.userAnswers,
          partnerProfile: context.result.partnerProfile,
          messages: nextMessages,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "聊天失败");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: payload.reply,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "聊天失败，请稍后重试。";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const runAgentVsAgent = async () => {
    if (!context) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "agent_to_agent",
          candidateName,
          userProfile: context.userAnswers,
          partnerProfile: context.result.partnerProfile,
          turns: 6,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "代理互聊失败");
      }

      setTranscript(payload.transcript ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "代理互聊失败，请稍后重试。";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">代理聊天</h1>
          <p className="mt-2 text-sm text-slate-600">
            目标：帮助双方快速了解、确认关系节奏与边界。
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/match" className="text-slate-700 underline-offset-4 hover:underline">
            返回匹配页
          </Link>
          <Link href="/questionnaire" className="text-slate-700 underline-offset-4 hover:underline">
            修改问卷
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("user_to_partner")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              mode === "user_to_partner"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            你 ↔ TA Agent
          </button>
          <button
            type="button"
            onClick={() => setMode("agent_to_agent")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              mode === "agent_to_agent"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            双方 Agent 互聊
          </button>
        </div>

        {!canChat ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {status || "请先完成一次匹配，然后再进入代理聊天。"}
          </p>
        ) : null}

        {canChat && mode === "user_to_partner" ? (
          <div className="mt-5">
            <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-xl px-3 py-2 text-sm leading-7 ${
                    message.role === "user"
                      ? "ml-auto max-w-[85%] bg-teal-700 text-white"
                      : "max-w-[85%] bg-white text-slate-800"
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入你想了解的问题，例如：我们对未来城市选择怎么看？"
                className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-teal-600"
              />
              <button
                type="button"
                onClick={sendUserMessage}
                disabled={loading || input.trim().length === 0}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
        ) : null}

        {canChat && mode === "agent_to_agent" ? (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={runAgentVsAgent}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "对话生成中..." : "开始 6 轮代理互聊"}
            </button>

            <div className="space-y-3">
              {transcript.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
                    {item.speaker}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-800">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {status && canChat ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}
