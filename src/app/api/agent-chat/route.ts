import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { normalizeAnswers } from "@/lib/matching";
import {
  readSecondMeSession,
  secondMeApiJson,
  secondMeChatOnce,
} from "@/lib/secondme";
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

async function yourSecondMeAgentReply(
  accessToken: string,
  partnerName: string,
  userProfile: QuestionnaireAnswers,
  partnerProfile: QuestionnaireAnswers,
  input: string,
  sessionId?: string,
) {
  const response = await secondMeChatOnce(accessToken, {
    message: input,
    sessionId,
    systemPrompt: [
      "你是用户本人的 SecondMe 沟通代理。",
      `当前目标：与 ${partnerName} 的代理有效沟通，推进双方了解。`,
      `用户画像：${JSON.stringify(profileSummary(userProfile))}`,
      `对方画像：${JSON.stringify(profileSummary(partnerProfile))}`,
      "请用简洁真诚语气回答，并提出一个澄清问题。",
    ].join("\n"),
  });

  return response;
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

async function ingestSecondMeChatEvent(
  accessToken: string,
  mode: "user_to_partner" | "agent_to_agent",
  candidateName: string,
  transcriptPreview: string,
) {
  await secondMeApiJson("/api/secondme/agent_memory/ingest", accessToken, {
    method: "POST",
    body: JSON.stringify({
      action: "agent_chat_session",
      displayText: `完成了一次${mode === "user_to_partner" ? "人机" : "双代理"}沟通，目标对象 ${candidateName}`,
      eventDesc: transcriptPreview.slice(0, 180),
      importance: 6,
      channel: "App",
      payload: {
        mode,
        candidateName,
      },
    }),
  });
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
  const session = readSecondMeSession(await cookies());

  if (mode === "user_to_partner") {
    const messages = parsed.data.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    try {
      const userInput = messages[messages.length - 1]?.content ?? "";
      let secondMePart = "";

      if (session?.accessToken) {
        const self = await yourSecondMeAgentReply(
          session.accessToken,
          candidateName,
          userProfile,
          partnerProfile,
          userInput,
        );
        secondMePart = `你的SecondMe代理建议：${self.text}`;
      }

      const partnerReply = modelConfig
        ? await partnerAgentReply(
            modelConfig,
            candidateName,
            userProfile,
            partnerProfile,
            messages,
          )
        : fallbackPartnerReply(candidateName);

      const reply = secondMePart
        ? `${secondMePart}\n\n${candidateName}的Agent回复：${partnerReply}`
        : partnerReply;

      if (session?.accessToken) {
        ingestSecondMeChatEvent(session.accessToken, mode, candidateName, reply).catch(
          () => {
            return;
          },
        );
      }

      return NextResponse.json({ reply }, { status: 200 });
    } catch {
      return NextResponse.json({ reply: fallbackPartnerReply(candidateName) }, { status: 200 });
    }
  }

  const turns = parsed.data.turns ?? 6;

  try {
    if (!modelConfig) {
      return NextResponse.json(
        {
          transcript: fallbackAgentVsAgent(candidateName, turns),
        },
        { status: 200 },
      );
    }

    let secondMeSessionId: string | undefined;
    const transcript: Array<{ id: string; speaker: string; text: string }> = [];
    let contextMessage = "请先确认关系目标与相处节奏。";

    for (let index = 0; index < turns; index += 1) {
      if (index % 2 === 0) {
        if (session?.accessToken) {
          const self = await yourSecondMeAgentReply(
            session.accessToken,
            candidateName,
            userProfile,
            partnerProfile,
            contextMessage,
            secondMeSessionId,
          );
          secondMeSessionId = self.sessionId;
          transcript.push({
            id: `${index + 1}`,
            speaker: "你的SecondMe Agent",
            text: self.text || "我想先了解你对关系节奏的期待。",
          });
          contextMessage = transcript[transcript.length - 1].text;
        } else {
          const fallback = fallbackAgentVsAgent(candidateName, turns)[index];
          transcript.push({
            id: `${index + 1}`,
            speaker: "你的Agent",
            text: fallback?.text ?? "我们先从价值观对齐开始聊。",
          });
          contextMessage = transcript[transcript.length - 1].text;
        }
      } else {
        const partnerMessage = await partnerAgentReply(
          modelConfig,
          candidateName,
          userProfile,
          partnerProfile,
          transcript.map((item) => ({
            role:
              item.speaker === "你的SecondMe Agent" || item.speaker === "你的Agent"
                ? "user"
                : "assistant",
            content: item.text,
          })),
        ).catch(() => fallbackPartnerReply(candidateName));

        transcript.push({
          id: `${index + 1}`,
          speaker: `${candidateName}的Agent`,
          text: partnerMessage,
        });

        contextMessage = partnerMessage;
      }
    }

    if (session?.accessToken) {
      const preview = transcript
        .map((item) => `${item.speaker}:${item.text}`)
        .join(" | ")
        .slice(0, 260);

      ingestSecondMeChatEvent(session.accessToken, mode, candidateName, preview).catch(
        () => {
          return;
        },
      );
    }

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
