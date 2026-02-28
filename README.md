# YueAgent MVP

校园 AI 月老 Demo，基于 Next.js 15 + Supabase + Vercel AI SDK v6。

## 已实现功能

- 首页：品牌介绍 + 每周二 21:00 匹配倒计时
- 认证：邮箱注册 / 登录 / 找回密码（Supabase Auth）
- 问卷：10 题问卷，JSONB 存储到 `questionnaires`
- 匹配：`/api/match` 升级为赛道3「多智能体竞赛 + 共识裁决 + 可验证哈希」
- 结果页：Framer Motion 动画揭晓 + Agent Arena 证据展示 + 决策 JSON 导出
- SecondMe：OAuth 连接、记忆读取、匹配/聊天事件写回
- 聊天：支持「你 ↔ TA Agent」与「你的SecondMe Agent ↔ TA Agent」
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
- 如果你之前已建过表并出现 `ON CONFLICT` 错误，再执行：
- `supabase/migrations/20260227_fix_questionnaires_unique.sql`

4. 启动开发环境

```bash
npm run dev
```

默认端口：`3002`

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
- `SECONDME_CLIENT_ID`
- `SECONDME_CLIENT_SECRET`
- `SECONDME_REDIRECT_URI`（建议：`http://localhost:3002/api/secondme/oauth/callback`）
- `SECONDME_OAUTH_BASE_URL`（默认：`https://api.mindverse.com/gate/lab`）
- `SECONDME_API_BASE_URL`（默认：`https://api.mindverse.com/gate/lab`）
- `SECONDME_APP_ID`（默认：`general`）
- 可选：`OPENROUTER_API_KEY` / `OPENAI_API_KEY`

## 目录

- `src/app`：页面与 API
- `src/components`：问卷、倒计时、结果卡
- `src/lib`：Supabase / SecondMe 客户端与匹配逻辑
- `public/manifest.json`：PWA 清单
- `supabase/schema.sql`：数据库脚本
- `docs/SECONDME_ARCHITECTURE.md`：SecondMe 架构重构说明
