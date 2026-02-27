import type { MatchCandidate, QuestionnaireAnswers } from "@/lib/types";

const DEFAULT_ANSWERS: QuestionnaireAnswers = {
  displayName: "同学",
  ageRange: "20-22",
  major: "未填写",
  coreValues: [],
  hobbies: [],
  weekendPlan: "citywalk",
  datePreference: "serious",
  communicationStyle: "balanced",
  futurePlan: "",
  relationshipValueScore: 4,
};

export function normalizeAnswers(
  raw: Partial<QuestionnaireAnswers> | null | undefined,
): QuestionnaireAnswers {
  if (!raw) {
    return DEFAULT_ANSWERS;
  }

  return {
    ...DEFAULT_ANSWERS,
    ...raw,
    coreValues: Array.isArray(raw.coreValues) ? raw.coreValues : [],
    hobbies: Array.isArray(raw.hobbies) ? raw.hobbies : [],
    relationshipValueScore:
      typeof raw.relationshipValueScore === "number"
        ? Math.min(7, Math.max(1, raw.relationshipValueScore))
        : DEFAULT_ANSWERS.relationshipValueScore,
  };
}

export function maskEmail(email: string) {
  const [prefix = "user", domain = "***"] = email.split("@");
  return `${prefix.slice(0, 2)}***@${domain}`;
}

function overlapRatio(listA: string[], listB: string[]) {
  if (listA.length === 0 || listB.length === 0) {
    return 0;
  }

  const setB = new Set(listB.map((item) => item.toLowerCase()));
  const overlap = listA.filter((item) => setB.has(item.toLowerCase())).length;

  return overlap / Math.max(listA.length, listB.length);
}

function futurePlanAffinity(a: string, b: string) {
  const tokensA = a
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const tokensB = new Set(
    b
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );

  if (tokensA.length === 0 || tokensB.size === 0) {
    return 0.4;
  }

  const overlap = tokensA.filter((token) => tokensB.has(token)).length;
  return Math.min(1, overlap / Math.max(2, tokensA.length));
}

export function calculateCompatibility(
  current: QuestionnaireAnswers,
  candidate: QuestionnaireAnswers,
) {
  const valueOverlap = overlapRatio(current.coreValues, candidate.coreValues);
  const hobbyOverlap = overlapRatio(current.hobbies, candidate.hobbies);
  const planScore = futurePlanAffinity(current.futurePlan, candidate.futurePlan);
  const communicationFit =
    current.communicationStyle === candidate.communicationStyle ? 1 : 0.45;
  const weekendFit = current.weekendPlan === candidate.weekendPlan ? 1 : 0.5;
  const dateFit = current.datePreference === candidate.datePreference ? 1 : 0.6;

  const score = Math.round(
    (valueOverlap * 32 +
      hobbyOverlap * 22 +
      planScore * 12 +
      communicationFit * 12 +
      weekendFit * 10 +
      dateFit * 8 +
      (1 - Math.abs(current.relationshipValueScore - candidate.relationshipValueScore) / 6) *
        4),
  ) / 1;

  const boundedScore = Math.max(48, Math.min(96, score));

  const reasons: string[] = [];

  if (valueOverlap >= 0.34) {
    reasons.push("核心价值观重叠度高，长期关系预期更稳定");
  }

  if (hobbyOverlap >= 0.25) {
    reasons.push("兴趣爱好有明显交集，线下约会更容易快速破冰");
  }

  if (communicationFit > 0.9) {
    reasons.push("沟通节奏一致，降低关系推进中的误解成本");
  }

  if (weekendFit > 0.9) {
    reasons.push("周末安排偏好接近，约会计划执行阻力更小");
  }

  if (reasons.length < 2) {
    reasons.push("双方在长期关系目标上接近，匹配稳定性较好");
    reasons.push("未来规划存在可对齐空间，适合继续深入了解");
  }

  return {
    score: boundedScore,
    reasons: reasons.slice(0, 4),
    summary: `综合价值观、兴趣与沟通风格评估后，兼容度约 ${boundedScore}%。`,
  };
}

const MOCK_PROFILES: Array<{
  userId: string;
  email: string;
  answers: QuestionnaireAnswers;
}> = [
  {
    userId: "mock-luna",
    email: "luna@example.com",
    answers: {
      displayName: "Luna",
      ageRange: "20-22",
      major: "新闻传播",
      coreValues: ["成长", "真诚", "责任感"],
      hobbies: ["citywalk", "摄影", "看展"],
      weekendPlan: "citywalk",
      datePreference: "serious",
      communicationStyle: "balanced",
      futurePlan: "毕业后想留在长沙发展，兼顾工作与生活质量",
      relationshipValueScore: 6,
    },
  },
  {
    userId: "mock-iris",
    email: "iris@example.com",
    answers: {
      displayName: "Iris",
      ageRange: "23-25",
      major: "软件工程",
      coreValues: ["自由", "成长", "同理心"],
      hobbies: ["编程", "咖啡", "羽毛球"],
      weekendPlan: "learning",
      datePreference: "serious",
      communicationStyle: "slow",
      futurePlan: "希望读研后做 AI 产品，长期看重稳定亲密关系",
      relationshipValueScore: 5,
    },
  },
  {
    userId: "mock-mia",
    email: "mia@example.com",
    answers: {
      displayName: "Mia",
      ageRange: "20-22",
      major: "建筑学",
      coreValues: ["家庭", "责任感", "稳定"],
      hobbies: ["音乐", "做饭", "徒步"],
      weekendPlan: "outdoor",
      datePreference: "serious",
      communicationStyle: "fast",
      futurePlan: "想在华中地区工作，之后一起养宠物与旅行",
      relationshipValueScore: 7,
    },
  },
];

export function fallbackCandidates(currentUserId: string): MatchCandidate[] {
  return MOCK_PROFILES.filter((profile) => profile.userId !== currentUserId).map(
    (profile) => ({
      userId: profile.userId,
      email: profile.email,
      answers: profile.answers,
    }),
  );
}
