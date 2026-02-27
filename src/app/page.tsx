import Link from "next/link";
import WeeklyCountdown from "@/components/WeeklyCountdown";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-teal-800">
            YUEAGENT · 校园 AI 月老
          </p>

          <h1 className="mt-6 font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
            每周一次认真匹配，
            <br className="hidden sm:block" />
            用 Agent 做可验证决策。
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            10 题问卷，1 次本周匹配。YueAgent 会输出兼容度、来电理由与结构化决策 JSON，
            让匹配过程透明可追踪。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              立即开始
            </Link>
            <Link
              href="/questionnaire"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 px-6 text-sm font-semibold text-slate-800 transition hover:border-slate-800"
            >
              直接填写问卷
            </Link>
          </div>
        </div>

        <WeeklyCountdown />
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "1. 邮箱登录",
            description: "Supabase Auth 支持注册、登录与找回密码。",
          },
          {
            title: "2. 问卷建模",
            description: "问卷答案以 JSONB 保存，方便持续扩展题目。",
          },
          {
            title: "3. Agent 匹配",
            description: "AI + 规则融合，输出结构化结果并可导出。",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
