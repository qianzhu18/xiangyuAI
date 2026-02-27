"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

type AuthMode = "login" | "signup" | "reset";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setSessionEmail(user?.email ?? null);
    };

    checkSession().catch(() => {
      setStatus("读取登录状态失败，请刷新页面重试。");
    });
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setStatus("未检测到 Supabase 环境变量，请先配置 .env.local");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
          },
        });

        if (error) {
          throw error;
        }

        setStatus("注册成功，请检查邮箱验证链接后登录。");
        setMode("login");
      }

      if (mode === "login") {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        setSessionEmail(data.user?.email ?? email);
        setStatus("登录成功，正在跳转问卷页...");
        router.push("/questionnaire");
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
        });

        if (error) {
          throw error;
        }

        setStatus("重置密码邮件已发送，请检查邮箱。");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "认证失败，请检查邮箱和密码后重试。";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSessionEmail(null);
    setStatus("已退出登录。");
  };

  if (!configured) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-16 sm:px-8">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">请先配置 Supabase 环境变量</p>
          <p className="mt-2 leading-7">
            当前未检测到 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
            可参考项目根目录 `.env.example`。
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900">注册 / 登录 YueAgent</h1>
          <p className="mt-2 text-sm text-slate-600">普通邮箱即可，无学校邮箱限制。</p>
        </div>
        <Link href="/" className="text-sm text-slate-700 underline-offset-4 hover:underline">
          返回首页
        </Link>
      </header>

      {sessionEmail ? (
        <article className="rounded-2xl border border-teal-200 bg-teal-50 p-6">
          <p className="text-sm text-teal-900">当前已登录：{sessionEmail}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/questionnaire"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-medium text-white"
            >
              去填写问卷
            </Link>
            <Link
              href="/match"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-teal-700 px-4 text-sm font-medium text-teal-800"
            >
              查看匹配页
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              退出登录
            </button>
          </div>
        </article>
      ) : (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { key: "login", label: "登录" },
              { key: "signup", label: "注册" },
              { key: "reset", label: "找回密码" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key as AuthMode)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  mode === item.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700 hover:border-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-800">邮箱</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                placeholder="you@example.com"
              />
            </label>

            {mode !== "reset" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">密码</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                  placeholder="至少 6 位"
                />
              </label>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "处理中..." : mode === "login" ? "登录" : mode === "signup" ? "注册" : "发送重置邮件"}
            </button>
          </form>
        </article>
      )}

      {status ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {status}
        </p>
      ) : null}
    </main>
  );
}
