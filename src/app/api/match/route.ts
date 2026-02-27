import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  calculateCompatibility,
  fallbackCandidates,
  maskEmail,
  normalizeAnswers,
} from "@/lib/matching";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { MatchCandidate, MatchDecision, QuestionnaireAnswers } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().optional(),
  answers: z.unknown().optional(),
});

const llmDecisionSchema = z.object({
  candidateUserId: z.string(),
  candidateName: z.string(),
  compatibilityScore: z.number().min(0).max(100),
  summary: z.string().min(12),
  reason: z.array(z.string().min(6)).min(2).max(5),
  thoughtProcess: z.string().min(24),
});

type ModelConfig = {
  provider: "groq" | "openrouter" | "openai" | "custom";
  apiKey: string;
  baseURL: string;
  model: string;
};

function resolveModelConfig(): ModelConfig | null {
  if (
    process.env.LLM_API_KEY &&
    process.env.LLM_BASE_URL &&
    process.env.LLM_MODEL
  ) {
    return {
      provider: "custom",
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  return null;
}

function buildCandidateName(answers: QuestionnaireAnswers, fallbackId: string) {
  return answers.displayName?.trim() || `用户${fallbackId.slice(0, 4)}`;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return null;
}

function resolveBestDeterministic(
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): MatchDecision {
  const ranking = candidates
    .map((candidate) => {
      const compatibility = calculateCompatibility(currentAnswers, candidate.answers);
      return {
        candidate,
        compatibility,
      };
    })
    .sort((left, right) => right.compatibility.score - left.compatibility.score);

  const top = ranking[0] ?? {
    candidate: {
      userId: "fallback-user",
      email: "candidate@example.com",
      answers: normalizeAnswers(null),
    },
    compatibility: {
      score: 71,
      summary: "基于默认画像计算，当前结果用于演示流程。",
      reasons: ["默认数据触发匹配流程", "建议完善真实问卷后重新匹配"],
    },
  };

  const candidateName = buildCandidateName(top.candidate.answers, top.candidate.userId);

  const thoughtProcess = [
    "Step 1: 读取当前用户问卷画像。",
    "Step 2: 比较候选对象在核心价值观、兴趣和沟通风格上的重叠度。",
    "Step 3: 综合长期关系意愿分，输出兼容度与理由。",
    `Step 4: 选择兼容度最高对象 ${candidateName}。`,
  ].join("\n");

  return {
    candidateUserId: top.candidate.userId,
    candidateName,
    maskedEmail: maskEmail(top.candidate.email),
    compatibilityScore: top.compatibility.score,
    summary: top.compatibility.summary,
    reason: top.compatibility.reasons,
    thoughtProcess,
    decisionJson: {
      engine: "deterministic-fallback",
      candidateUserId: top.candidate.userId,
      candidateName,
      compatibilityScore: top.compatibility.score,
      reason: top.compatibility.reasons,
      thoughtProcess,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function loadCandidates(currentUserId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return fallbackCandidates(currentUserId);
  }

  const { data, error } = await admin
    .from("questionnaires")
    .select("user_id, answers")
    .neq("user_id", currentUserId);

  if (error) {
    return fallbackCandidates(currentUserId);
  }

  const candidates = (data ?? [])
    .map((row) => {
      const userId = String(row.user_id ?? "");
      const rawAnswers =
        row.answers && typeof row.answers === "object"
          ? (row.answers as Partial<QuestionnaireAnswers> & {
              profileEmail?: unknown;
            })
          : null;

      const email =
        typeof rawAnswers?.profileEmail === "string" && rawAnswers.profileEmail.includes("@")
          ? rawAnswers.profileEmail
          : `${userId.slice(0, 8) || "anonymous"}@example.com`;

      return {
        userId,
        email,
        answers: normalizeAnswers(rawAnswers),
      } as MatchCandidate;
    })
    .filter((item) => item.userId.length > 0);

  return candidates.length > 0 ? candidates : fallbackCandidates(currentUserId);
}

async function tryLlmDecision(
  currentUserId: string,
  currentEmail: string,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): Promise<MatchDecision | null> {
  const modelConfig = resolveModelConfig();

  if (!modelConfig) {
    return null;
  }

  const provider = createOpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: modelConfig.baseURL,
  });

  const candidateMap = new Map(candidates.map((candidate) => [candidate.userId, candidate]));

  const tools = {
    getAllProfiles: tool({
      description: "获取全部候选匹配对象及其画像（已匿名）",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ limit }) => {
        const max = limit ?? 20;
        return candidates.slice(0, max).map((candidate) => ({
          userId: candidate.userId,
          displayName: buildCandidateName(candidate.answers, candidate.userId),
          ageRange: candidate.answers.ageRange,
          major: candidate.answers.major,
          coreValues: candidate.answers.coreValues,
          hobbies: candidate.answers.hobbies,
          weekendPlan: candidate.answers.weekendPlan,
          datePreference: candidate.answers.datePreference,
          communicationStyle: candidate.answers.communicationStyle,
          relationshipValueScore: candidate.answers.relationshipValueScore,
        }));
      },
    }),
    calculateMatch: tool({
      description: "输入候选 userId，返回与当前用户的兼容度和理由",
      inputSchema: z.object({
        candidateUserId: z.string().min(1),
      }),
      execute: async ({ candidateUserId }) => {
        const candidate = candidateMap.get(candidateUserId);

        if (!candidate) {
          return {
            candidateUserId,
            score: 0,
            summary: "候选对象不存在",
            reasons: ["请先调用 getAllProfiles 后再计算"],
          };
        }

        const compatibility = calculateCompatibility(currentAnswers, candidate.answers);

        return {
          candidateUserId,
          score: compatibility.score,
          summary: compatibility.summary,
          reasons: compatibility.reasons,
        };
      },
    }),
  };

  try {
    const { output } = await generateText({
      model: provider.chat(modelConfig.model),
      system:
        "你是校园 AI 月老。必须先调用 getAllProfiles，再调用 calculateMatch 至少一次。最终输出 JSON。",
      prompt: [
        `当前用户ID: ${currentUserId}`,
        `当前用户邮箱（仅用于日志）: ${currentEmail || "unknown@example.com"}`,
        `当前用户问卷: ${JSON.stringify(currentAnswers)}`,
        "输出字段必须为：candidateUserId, candidateName, compatibilityScore, summary, reason, thoughtProcess",
      ].join("\n"),
      tools,
      stopWhen: stepCountIs(6),
      output: Output.object({ schema: llmDecisionSchema }),
    });

    const parsed = llmDecisionSchema.parse(output);
    const picked = candidateMap.get(parsed.candidateUserId);

    if (!picked) {
      return null;
    }

    const deterministic = calculateCompatibility(currentAnswers, picked.answers);

    const finalResult: MatchDecision = {
      candidateUserId: picked.userId,
      candidateName:
        parsed.candidateName?.trim() || buildCandidateName(picked.answers, picked.userId),
      maskedEmail: maskEmail(picked.email),
      compatibilityScore: Math.round((parsed.compatibilityScore + deterministic.score) / 2),
      summary: parsed.summary,
      reason: parsed.reason,
      thoughtProcess: parsed.thoughtProcess,
      decisionJson: {
        engine: "ai-sdk-v6",
        provider: modelConfig.provider,
        model: modelConfig.model,
        inputUserId: currentUserId,
        candidateUserId: picked.userId,
        llmOutput: parsed,
        deterministic,
        generatedAt: new Date().toISOString(),
      },
    };

    return finalResult;
  } catch {
    return null;
  }
}

async function tryLlmDirectDecision(
  currentUserId: string,
  currentEmail: string,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): Promise<MatchDecision | null> {
  const modelConfig = resolveModelConfig();

  if (!modelConfig) {
    return null;
  }

  const provider = createOpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: modelConfig.baseURL,
  });

  const candidateMap = new Map(candidates.map((candidate) => [candidate.userId, candidate]));
  const candidateSummary = candidates.map((candidate) => ({
    userId: candidate.userId,
    displayName: buildCandidateName(candidate.answers, candidate.userId),
    ageRange: candidate.answers.ageRange,
    major: candidate.answers.major,
    coreValues: candidate.answers.coreValues,
    hobbies: candidate.answers.hobbies,
    weekendPlan: candidate.answers.weekendPlan,
    datePreference: candidate.answers.datePreference,
    communicationStyle: candidate.answers.communicationStyle,
    relationshipValueScore: candidate.answers.relationshipValueScore,
  }));

  try {
    const { text } = await generateText({
      model: provider.chat(modelConfig.model),
      system:
        "你是校园 AI 月老。根据当前用户画像和候选列表，选出最佳匹配对象。你必须只输出一个 JSON 对象，不要输出任何额外文本。",
      prompt: [
        `当前用户ID: ${currentUserId}`,
        `当前用户邮箱（仅用于日志）: ${currentEmail || "unknown@example.com"}`,
        `当前用户问卷: ${JSON.stringify(currentAnswers)}`,
        `候选列表: ${JSON.stringify(candidateSummary)}`,
        "必须从候选列表里选择 candidateUserId。",
        "输出 JSON 字段：candidateUserId, candidateName, compatibilityScore, summary, reason, thoughtProcess。",
        "reason 必须是字符串数组（2~5条），compatibilityScore 为 0~100 数字。",
      ].join("\n"),
    });

    const jsonText = extractJsonObject(text);

    if (!jsonText) {
      return null;
    }

    const parsed = llmDecisionSchema.parse(JSON.parse(jsonText));
    const picked = candidateMap.get(parsed.candidateUserId);

    if (!picked) {
      return null;
    }

    const deterministic = calculateCompatibility(currentAnswers, picked.answers);

    return {
      candidateUserId: picked.userId,
      candidateName:
        parsed.candidateName?.trim() || buildCandidateName(picked.answers, picked.userId),
      maskedEmail: maskEmail(picked.email),
      compatibilityScore: Math.round((parsed.compatibilityScore + deterministic.score) / 2),
      summary: parsed.summary,
      reason: parsed.reason,
      thoughtProcess: parsed.thoughtProcess,
      decisionJson: {
        engine: "ai-sdk-v6-direct-json",
        provider: modelConfig.provider,
        model: modelConfig.model,
        inputUserId: currentUserId,
        candidateUserId: picked.userId,
        llmOutput: parsed,
        deterministic,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

async function persistMatch(result: MatchDecision, userId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return;
  }

  await admin.from("matches").insert({
    user1_id: userId,
    user2_id: result.candidateUserId,
    score: result.compatibilityScore,
    reason_json: result.decisionJson,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数不完整，请提供 userId" },
        { status: 400 },
      );
    }

    const { userId, email, answers } = parsed.data;
    const currentAnswers = normalizeAnswers(
      answers as Partial<QuestionnaireAnswers> | null,
    );

    const candidates = await loadCandidates(userId);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "暂无可匹配对象，请先让更多用户完成问卷" },
        { status: 400 },
      );
    }

    const llmResult = await tryLlmDecision(
      userId,
      email ?? "",
      currentAnswers,
      candidates,
    );

    const llmDirectResult =
      llmResult ??
      (await tryLlmDirectDecision(userId, email ?? "", currentAnswers, candidates));

    const finalResult =
      llmDirectResult ?? resolveBestDeterministic(currentAnswers, candidates);

    await persistMatch(finalResult, userId);

    return NextResponse.json(
      {
        thoughtProcess: finalResult.thoughtProcess,
        result: finalResult,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "匹配服务异常";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
