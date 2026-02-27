# YueAgent MVP

校园 AI 月老 Demo，基于 Next.js 15 + Supabase + Vercel AI SDK v6。

## 已实现功能

- 首页：品牌介绍 + 每周二 21:00 匹配倒计时
- 认证：邮箱注册 / 登录 / 找回密码（Supabase Auth）
- 问卷：10 题问卷，JSONB 存储到 `questionnaires`
- 匹配：`/api/match` 调用 AI SDK 工具链，输出最佳匹配 + 兼容度 + 理由
- 结果页：Framer Motion 动画揭晓 + Agent 决策 JSON 导出
- PWA：`manifest.json` + `next-pwa`（构建时生成 `sw.js`）

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env.local
```

3. 在 Supabase SQL Editor 执行建表脚本

- `supabase/schema.sql`

4. 启动开发环境

```bash
npm run dev
```

5. 生产构建验证

```bash
npm run lint
npm run build
```

## 关键环境变量

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（用于服务端读取候选和写入 `matches`）
- `LLM_API_KEY`
- `LLM_BASE_URL`（智谱 OpenAI 协议示例：`https://open.bigmodel.cn/api/coding/paas/v4`）
- `LLM_MODEL`（示例：`GLM-4.7`）
- 可选：`OPENROUTER_API_KEY` / `OPENAI_API_KEY`

## 目录

- `src/app`：页面与 API
- `src/components`：问卷、倒计时、结果卡
- `src/lib`：Supabase 客户端与匹配逻辑
- `public/manifest.json`：PWA 清单
- `supabase/schema.sql`：数据库脚本
