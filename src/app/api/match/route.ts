import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import {
  buildFitAdvice,
  calculateCompatibility,
  ensureSyntheticCandidatePool,
  fallbackCandidates,
  maskEmail,
  normalizeAnswers,
} from "@/lib/matching";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type {
  AgentEvaluation,
  MatchArena,
  MatchCandidate,
  MatchDecision,
  QuestionnaireAnswers,
} from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  answers: z.unknown().optional(),
});

const agentRoundOutputSchema = z.object({
  assessments: z.array(
    z.object({
      candidateUserId: z.string().min(1),
      score: z.number().min(0).max(100),
      rationale: z.string().min(6),
    }),
  ),
  summary: z.string().min(8),
});

type ModelConfig = {
  provider: "groq" | "openrouter" | "openai" | "custom";
  apiKey: string;
  baseURL: string;
  model: string;
};

type ArenaAgent = {
  id: string;
  name: string;
  focus: string;
  weight: number;
};

const ARENA_AGENTS: ArenaAgent[] = [
  {
    id: "value-scout",
    name: "价值观侦察员",
    focus: "主看核心价值观与长期关系稳定性。",
    weight: 0.4,
  },
  {
    id: "lifestyle-scout",
    name: "生活方式侦察员",
    focus: "主看兴趣、周末节奏与线下相处摩擦成本。",
    weight: 0.35,
  },
  {
    id: "future-scout",
    name: "未来规划侦察员",
    focus: "主看未来规划可对齐程度与长期协作潜力。",
    weight: 0.25,
  },
];

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

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function hashPayload(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function loadCandidates(currentUserId: string) {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return ensureSyntheticCandidatePool(
      currentUserId,
      fallbackCandidates(currentUserId),
      12,
    );
  }

  const { data, error } = await admin
    .from("questionnaires")
    .select("user_id, answers")
    .neq("user_id", currentUserId);

  if (error) {
    return ensureSyntheticCandidatePool(
      currentUserId,
      fallbackCandidates(currentUserId),
      12,
    );
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

  return ensureSyntheticCandidatePool(currentUserId, candidates, 12);
}

function deterministicAgentRound(
  agent: ArenaAgent,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): AgentEvaluation[] {
  return candidates.map((candidate) => {
    const base = calculateCompatibility(currentAnswers, candidate.answers);
    let delta = 0;

    if (agent.id === "value-scout") {
      delta = base.reasons[0]?.includes("价值观") ? 6 : -2;
    }

    if (agent.id === "lifestyle-scout") {
      delta =
        currentAnswers.weekendPlan === candidate.answers.weekendPlan
          ? 4
          : currentAnswers.hobbies.some((item) =>
                candidate.answers.hobbies.includes(item),
              )
            ? 2
            : -3;
    }

    if (agent.id === "future-scout") {
      delta =
        Math.abs(
          currentAnswers.relationshipValueScore -
            candidate.answers.relationshipValueScore,
        ) <= 1
          ? 5
          : -2;
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      focus: agent.focus,
      candidateUserId: candidate.userId,
      candidateName: buildCandidateName(candidate.answers, candidate.userId),
      score: clampScore(base.score + delta),
      rationale: `${agent.name}评估：${base.reasons[0] ?? "匹配稳定性较好"}`,
      round: 1,
      voteWeight: agent.weight,
    };
  });
}

async function llmAgentRound(
  modelConfig: ModelConfig,
  agent: ArenaAgent,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): Promise<AgentEvaluation[] | null> {
  const provider = createOpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: modelConfig.baseURL,
  });

  const candidateSummary = candidates.map((candidate) => ({
    userId: candidate.userId,
    displayName: buildCandidateName(candidate.answers, candidate.userId),
    coreValues: candidate.answers.coreValues,
    hobbies: candidate.answers.hobbies,
    weekendPlan: candidate.answers.weekendPlan,
    datePreference: candidate.answers.datePreference,
    communicationStyle: candidate.answers.communicationStyle,
    futurePlan: candidate.answers.futurePlan,
    relationshipValueScore: candidate.answers.relationshipValueScore,
  }));

  try {
    const { text } = await generateText({
      model: provider.chat(modelConfig.model),
      system: [
        "你是一个匹配竞赛智能体。",
        `角色：${agent.name}`,
        `角色关注点：${agent.focus}`,
        "你必须只返回 JSON 对象，不要返回额外文本。",
      ].join("\n"),
      prompt: [
        `当前用户问卷: ${JSON.stringify(currentAnswers)}`,
        `候选列表: ${JSON.stringify(candidateSummary)}`,
        "返回格式：",
        JSON.stringify(
          {
            assessments: [
              {
                candidateUserId: "string",
                score: 78,
                rationale: "string",
              },
            ],
            summary: "string",
          },
          null,
          2,
        ),
      ].join("\n"),
    });

    const jsonText = extractJsonObject(text);

    if (!jsonText) {
      return null;
    }

    const parsed = agentRoundOutputSchema.parse(JSON.parse(jsonText));
    const byId = new Map(parsed.assessments.map((item) => [item.candidateUserId, item]));

    return candidates.map((candidate) => {
      const item = byId.get(candidate.userId);
      const fallback = calculateCompatibility(currentAnswers, candidate.answers);

      return {
        agentId: agent.id,
        agentName: agent.name,
        focus: agent.focus,
        candidateUserId: candidate.userId,
        candidateName: buildCandidateName(candidate.answers, candidate.userId),
        score: clampScore(item?.score ?? fallback.score),
        rationale: item?.rationale ?? `${agent.name}评估：${fallback.reasons[0]}`,
        round: 1,
        voteWeight: agent.weight,
      };
    });
  } catch {
    return null;
  }
}

function composeDecision(
  userId: string,
  email: string,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
  modelConfig: ModelConfig | null,
  runId: string,
  logs: string[],
  allEvaluations: AgentEvaluation[],
): MatchDecision {
  const aggregate = candidates
    .map((candidate) => {
      const related = allEvaluations.filter(
        (item) => item.candidateUserId === candidate.userId,
      );
      const weightedScore = related.reduce(
        (sum, item) => sum + item.score * item.voteWeight,
        0,
      );

      return {
        candidate,
        weightedScore: clampScore(weightedScore),
        evaluations: related,
      };
    })
    .sort((left, right) => right.weightedScore - left.weightedScore);

  let winner = aggregate[0];
  let runnerUp = aggregate[1] ?? null;

  const initialGap = runnerUp ? winner.weightedScore - runnerUp.weightedScore : 99;
  logs.push(`Round 2/3 · 共识差距检查，当前分差 ${initialGap.toFixed(0)} 分`);

  if (runnerUp && initialGap <= 8) {
    const winnerDeterministic = calculateCompatibility(
      currentAnswers,
      winner.candidate.answers,
    ).score;
    const runnerUpDeterministic = calculateCompatibility(
      currentAnswers,
      runnerUp.candidate.answers,
    ).score;

    winner.weightedScore = clampScore(winner.weightedScore * 0.85 + winnerDeterministic * 0.15);
    runnerUp.weightedScore = clampScore(
      runnerUp.weightedScore * 0.85 + runnerUpDeterministic * 0.15,
    );

    logs.push(
      `Round 2/3 · 触发仲裁器，补充可验证规则分（${winnerDeterministic}/${runnerUpDeterministic}）`,
    );

    const reordered = [winner, runnerUp, ...aggregate.slice(2)].sort(
      (left, right) => right.weightedScore - left.weightedScore,
    );

    winner = reordered[0];
    runnerUp = reordered[1] ?? null;
  }

  const finalGap = runnerUp ? winner.weightedScore - runnerUp.weightedScore : 99;
  const winnerName = buildCandidateName(winner.candidate.answers, winner.candidate.userId);

  logs.push(
    `Round 3/3 · 共识完成，赢家 ${winnerName}，领先 ${finalGap.toFixed(0)} 分`,
  );

  const winnerReasons = winner.evaluations
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => `${item.agentName}：${item.rationale}`);

  const verificationPayload: Record<string, unknown> = {
    runId,
    track: "赛道3-智能体驱动应用",
    lane: "多智能体协作竞赛 + 可验证决策",
    cycleMinutes: 5,
    userId,
    emailMasked: maskEmail(email || "unknown@example.com"),
    candidateIds: candidates.map((item) => item.userId),
    evaluations: allEvaluations,
    finalRanking: aggregate.map((item) => ({
      candidateUserId: item.candidate.userId,
      score: item.weightedScore,
    })),
    generatedAt: new Date().toISOString(),
  };

  const arena: MatchArena = {
    track: "赛道3-智能体驱动应用",
    lane: "多智能体协作竞赛 + 可验证决策",
    runId,
    cycleMinutes: 5,
    rounds: 3,
    candidateCount: candidates.length,
    logs,
    agentEvaluations: allEvaluations,
    consensus: {
      winnerUserId: winner.candidate.userId,
      winnerName,
      score: winner.weightedScore,
      runnerUpUserId: runnerUp?.candidate.userId ?? null,
      gap: finalGap,
    },
    verificationHash: hashPayload(verificationPayload),
    verificationPayload,
  };

  return {
    candidateUserId: winner.candidate.userId,
    candidateName: winnerName,
    maskedEmail: maskEmail(winner.candidate.email),
    compatibilityScore: winner.weightedScore,
    summary: `3个智能体完成 3 轮竞赛评估后，${winnerName} 以 ${winner.weightedScore}% 兼容度胜出。`,
    reason: winnerReasons,
    thoughtProcess: logs.join("\n"),
    fitAdvice: buildFitAdvice(currentAnswers, winner.candidate.answers),
    partnerProfile: winner.candidate.answers,
    arena,
    decisionJson: {
      engine: modelConfig ? "multi-agent-arena-llm+rule" : "multi-agent-arena-rule-only",
      provider: modelConfig?.provider ?? null,
      model: modelConfig?.model ?? null,
      ...arena,
    },
  };
}

function emergencyDecision(
  userId: string,
  email: string,
  answers: QuestionnaireAnswers,
) {
  const emergencyCandidates = ensureSyntheticCandidatePool(
    userId,
    fallbackCandidates(userId),
    12,
  );

  const logs = [
    "Round 1/3 · 检测到服务波动，切换应急匹配模式",
    "Round 2/3 · 使用离线规则完成候选排序",
    "Round 3/3 · 已输出可用匹配结果与建议",
  ];

  const evaluations: AgentEvaluation[] = ARENA_AGENTS.flatMap((agent) =>
    deterministicAgentRound(agent, answers, emergencyCandidates),
  );

  return composeDecision(
    userId,
    email,
    answers,
    emergencyCandidates,
    null,
    randomUUID(),
    logs,
    evaluations,
  );
}

async function buildArenaDecision(
  userId: string,
  email: string,
  currentAnswers: QuestionnaireAnswers,
  candidates: MatchCandidate[],
): Promise<MatchDecision> {
  const modelConfig = resolveModelConfig();
  const runId = randomUUID();
  const logs: string[] = ["Round 1/3 · 多智能体并行打分开始"];
  const allEvaluations: AgentEvaluation[] = [];

  for (const agent of ARENA_AGENTS) {
    const llmRound =
      modelConfig === null
        ? null
        : await llmAgentRound(modelConfig, agent, currentAnswers, candidates);

    const evaluations =
      llmRound ?? deterministicAgentRound(agent, currentAnswers, candidates);
    allEvaluations.push(...evaluations);

    const vote = [...evaluations].sort((a, b) => b.score - a.score)[0];
    logs.push(
      `Round 1/3 · ${agent.name} 投票 ${vote.candidateName} (${vote.score.toFixed(0)} 分)`,
    );
  }

  return composeDecision(
    userId,
    email,
    currentAnswers,
    candidates,
    modelConfig,
    runId,
    logs,
    allEvaluations,
  );
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
  const raw = await request.json().catch(() => ({} as Record<string, unknown>));
  const parsed = requestSchema.safeParse(raw);

  const userId = parsed.success ? parsed.data.userId || `guest-${Date.now()}` : `guest-${Date.now()}`;
  const email = parsed.success ? parsed.data.email ?? "" : "";
  const currentAnswers = normalizeAnswers(
    (parsed.success ? parsed.data.answers : raw.answers) as
      | Partial<QuestionnaireAnswers>
      | null
      | undefined,
  );

  try {
    const candidates = await loadCandidates(userId);

    const finalResult = await buildArenaDecision(
      userId,
      email,
      currentAnswers,
      candidates,
    );

    await persistMatch(finalResult, userId);

    return NextResponse.json(
      {
        thoughtProcess: finalResult.thoughtProcess,
        result: finalResult,
      },
      { status: 200 },
    );
  } catch {
    const fallback = emergencyDecision(userId, email, currentAnswers);

    return NextResponse.json(
      {
        thoughtProcess: fallback.thoughtProcess,
        result: fallback,
      },
      { status: 200 },
    );
  }
}
