"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionnaireForm from "@/components/QuestionnaireForm";
import type { QuestionnaireAnswers } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function QuestionnairePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  const [initialValues, setInitialValues] = useState<Partial<QuestionnaireAnswers>>();
  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

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
        setStatus(`读取历史问卷失败：${error.message}`);
      }

      if (data?.answers && typeof data.answers === "object") {
        setInitialValues(data.answers as Partial<QuestionnaireAnswers>);
      }

      setLoadingPage(false);
    };

    boot().catch((error) => {
      setLoadingPage(false);
      const message =
        error instanceof Error ? error.message : "读取问卷状态失败，请稍后刷新。";
      setStatus(message);
    });

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  const handleSubmit = async (answers: QuestionnaireAnswers) => {
    if (!supabase || !userId) {
      setStatus("会话状态异常，请重新登录后再试。");
      return;
    }

    setSubmitting(true);
    setStatus("");

    const payload = {
      ...answers,
      profileEmail: userEmail,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("questionnaires").upsert(
      {
        user_id: userId,
        answers: payload,
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setSubmitting(false);
      setStatus(`保存失败：${error.message}`);
      return;
    }

    setSubmitting(false);
    router.push("/match");
  };

  if (!configured) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-16 sm:px-8">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">尚未配置 Supabase</p>
          <p className="mt-2 leading-7">
            请先在 `.env.local` 配置 `NEXT_PUBLIC_SUPABASE_URL` 和
            `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
          </p>
        </article>
      </main>
    );
  }

  if (loadingPage) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-16 sm:px-8">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          正在加载问卷...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">10 题人格问卷</h1>
          <p className="mt-2 text-sm text-slate-600">
            答案会以 JSONB 保存，并用于 Agent 本周匹配计算。
          </p>
        </div>
        <Link href="/match" className="text-sm text-slate-700 underline-offset-4 hover:underline">
          去匹配页
        </Link>
      </header>

      <QuestionnaireForm
        initialValues={initialValues}
        loading={submitting}
        onSubmit={handleSubmit}
      />

      {status ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {status}
        </p>
      ) : null}
    </main>
  );
}
