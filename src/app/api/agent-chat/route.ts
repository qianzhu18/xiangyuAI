import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { normalizeAnswers } from "@/lib/matching";
import type { QuestionnaireAnswers } from "@/lib/types";

export const runtime = "nodejs";

type ModelConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const requestSchema = z.object({
  mode: z.enum(["user_to_partner", "agent_to_agent"]),
  candidateName: z.string().min(1),
  userProfile: z.unknown().optional(),
  partnerProfile: z.unknown().optional(),
  messages: z.array(messageSchema).optional(),
  turns: z.number().int().min(2).max(10).optional(),
});

function resolveModelConfig(): ModelConfig | null {
  if (
    process.env.LLM_API_KEY &&
    process.env.LLM_BASE_URL &&
    process.env.LLM_MODEL
  ) {
    return {
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
    };
  }

  return null;
}

function profileSummary(profile: QuestionnaireAnswers) {
  return {
    displayName: profile.displayName,
    major: profile.major,
    coreValues: profile.coreValues,
    hobbies: profile.hobbies,
    weekendPlan: profile.weekendPlan,
    datePreference: profile.datePreference,
    communicationStyle: profile.communicationStyle,
    futurePlan: profile.futurePlan,
    relationshipValueScore: profile.relationshipValueScore,
  };
}

async function partnerAgentReply(
  modelConfig: ModelConfig,
  candidateName: string,
  userProfile: QuestionnaireAnswers,
  partnerProfile: QuestionnaireAnswers,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const provider = createOpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: modelConfig.baseURL,
  });

  const history = messages
    .map((message) =>
      message.role === "user"
        ? `用户代理: ${message.content}`
        : `对方代理: ${message.content}`,
    )
    .join("\n");

  const { text } = await generateText({
    model: provider.chat(modelConfig.model),
    system: [
      `你是 ${candidateName} 的恋爱沟通代理。`,
      "你的目标：帮助双方更高效了解、明确边界、减少误解。",
      "输出要求：80~160字，语气真诚，必须包含一个提问。",
    ].join("\n"),
    prompt: [
      `用户画像: ${JSON.stringify(profileSummary(userProfile))}`,
      `对方画像: ${JSON.stringify(profileSummary(partnerProfile))}`,
      `历史对话:\n${history}`,
      "请回复下一句对方代理话术。",
    ].join("\n"),
  });

  return text.trim();
}

async function runAgentVsAgent(
  modelConfig: ModelConfig,
  candidateName: string,
  userProfile: QuestionnaireAnswers,
  partnerProfile: QuestionnaireAnswers,
  turns: number,
) {
  const provider = createOpenAI({
    apiKey: modelConfig.apiKey,
    baseURL: modelConfig.baseURL,
  });

  const { text } = await generateText({
    model: provider.chat(modelConfig.model),
    system: [
      "你是双代理关系协调器。",
      "请模拟 A(用户代理) 与 B(对方代理) 的多轮对话，目标是互相了解和明确边界。",
      "必须只输出 JSON 数组，每项格式：{speaker:'A'|'B', text:'...'}。",
    ].join("\n"),
    prompt: [
      `回合数: ${turns}`,
      `A画像: ${JSON.stringify(profileSummary(userProfile))}`,
      `B画像: ${JSON.stringify(profileSummary(partnerProfile))}`,
      "要求：至少出现一次价值观对齐讨论、一次未来规划讨论、一次边界确认。",
    ].join("\n"),
  });

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("invalid_transcript");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{
    speaker: "A" | "B";
    text: string;
  }>;

  return parsed
    .filter((item) => item.text?.trim())
    .slice(0, turns)
    .map((item, index) => ({
      id: `${index + 1}`,
      speaker: item.speaker === "A" ? "你的Agent" : `${candidateName}的Agent`,
      text: item.text.trim(),
    }));
}

function fallbackPartnerReply(candidateName: string) {
  return `${candidateName}的Agent：我建议我们先从共同兴趣聊起，再确认彼此对关系节奏的期待。你更希望每周约会几次？`;
}

function fallbackAgentVsAgent(candidateName: string, turns: number) {
  const script = [
    {
      speaker: "你的Agent",
      text: "我们先确认目标：偏长期关系，还是先从低压力相处开始？",
    },
    {
      speaker: `${candidateName}的Agent`,
      text: "建议先从朋友节奏切入，两周后再评估关系推进速度。",
    },
    {
      speaker: "你的Agent",
      text: "未来规划上，是否接受短期异地或学业优先阶段？",
    },
    {
      speaker: `${candidateName}的Agent`,
      text: "可接受阶段性异地，但需要提前约定沟通频率和见面计划。",
    },
    {
      speaker: "你的Agent",
      text: "边界方面先约定：冲突当天不拉黑、不冷暴力，24小时内复盘。",
    },
    {
      speaker: `${candidateName}的Agent`,
      text: "同意，并增加一条：重要决定先沟通，不做单方面预设。",
    },
  ];

  return script.slice(0, turns).map((item, index) => ({
    id: `${index + 1}`,
    ...item,
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数无效" }, { status: 400 });
  }

  const { mode, candidateName } = parsed.data;
  const userProfile = normalizeAnswers(
    parsed.data.userProfile as Partial<QuestionnaireAnswers> | null,
  );
  const partnerProfile = normalizeAnswers(
    parsed.data.partnerProfile as Partial<QuestionnaireAnswers> | null,
  );
  const modelConfig = resolveModelConfig();

  if (mode === "user_to_partner") {
    const messages = parsed.data.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    if (!modelConfig) {
      return NextResponse.json({ reply: fallbackPartnerReply(candidateName) }, { status: 200 });
    }

    try {
      const reply = await partnerAgentReply(
        modelConfig,
        candidateName,
        userProfile,
        partnerProfile,
        messages,
      );

      return NextResponse.json({ reply }, { status: 200 });
    } catch {
      return NextResponse.json({ reply: fallbackPartnerReply(candidateName) }, { status: 200 });
    }
  }

  const turns = parsed.data.turns ?? 6;

  if (!modelConfig) {
    return NextResponse.json(
      {
        transcript: fallbackAgentVsAgent(candidateName, turns),
      },
      { status: 200 },
    );
  }

  try {
    const transcript = await runAgentVsAgent(
      modelConfig,
      candidateName,
      userProfile,
      partnerProfile,
      turns,
    );

    return NextResponse.json({ transcript }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        transcript: fallbackAgentVsAgent(candidateName, turns),
      },
      { status: 200 },
    );
  }
}
