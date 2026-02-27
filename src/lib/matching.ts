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

type SyntheticTemplate = {
  key: string;
  email: string;
  answers: QuestionnaireAnswers;
};

const SYNTHETIC_TEMPLATES: SyntheticTemplate[] = [
  {
    key: "synth-luna",
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
    key: "synth-iris",
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
    key: "synth-mia",
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
  {
    key: "synth-zoe",
    email: "zoe@example.com",
    answers: {
      displayName: "Zoe",
      ageRange: "18-19",
      major: "法学",
      coreValues: ["责任感", "真诚", "稳定"],
      hobbies: ["阅读", "citywalk", "咖啡"],
      weekendPlan: "home",
      datePreference: "serious",
      communicationStyle: "balanced",
      futurePlan: "准备法考，计划在长沙长期发展",
      relationshipValueScore: 6,
    },
  },
  {
    key: "synth-amy",
    email: "amy@example.com",
    answers: {
      displayName: "Amy",
      ageRange: "20-22",
      major: "金融学",
      coreValues: ["成长", "上进", "自由"],
      hobbies: ["旅行", "羽毛球", "咖啡"],
      weekendPlan: "outdoor",
      datePreference: "slow",
      communicationStyle: "fast",
      futurePlan: "先就业积累再申请海外硕士",
      relationshipValueScore: 4,
    },
  },
  {
    key: "synth-nora",
    email: "nora@example.com",
    answers: {
      displayName: "Nora",
      ageRange: "23-25",
      major: "临床医学",
      coreValues: ["同理心", "责任感", "家庭"],
      hobbies: ["做饭", "音乐", "徒步"],
      weekendPlan: "home",
      datePreference: "serious",
      communicationStyle: "slow",
      futurePlan: "规培后留院，重视长期稳定关系",
      relationshipValueScore: 7,
    },
  },
  {
    key: "synth-coco",
    email: "coco@example.com",
    answers: {
      displayName: "Coco",
      ageRange: "20-22",
      major: "工业设计",
      coreValues: ["成长", "自由", "真诚"],
      hobbies: ["看展", "摄影", "旅行"],
      weekendPlan: "citywalk",
      datePreference: "slow",
      communicationStyle: "balanced",
      futurePlan: "想做用户体验设计，愿意尝试跨城市发展",
      relationshipValueScore: 5,
    },
  },
  {
    key: "synth-kiki",
    email: "kiki@example.com",
    answers: {
      displayName: "Kiki",
      ageRange: "20-22",
      major: "会计学",
      coreValues: ["稳定", "责任感", "家庭"],
      hobbies: ["阅读", "做饭", "桌游"],
      weekendPlan: "home",
      datePreference: "serious",
      communicationStyle: "balanced",
      futurePlan: "考证后在省内发展，偏好长期关系",
      relationshipValueScore: 6,
    },
  },
  {
    key: "synth-jade",
    email: "jade@example.com",
    answers: {
      displayName: "Jade",
      ageRange: "23-25",
      major: "机械工程",
      coreValues: ["上进", "成长", "责任感"],
      hobbies: ["运动", "徒步", "咖啡"],
      weekendPlan: "outdoor",
      datePreference: "serious",
      communicationStyle: "fast",
      futurePlan: "读博或进研发团队，接受共同成长型关系",
      relationshipValueScore: 5,
    },
  },
  {
    key: "synth-rose",
    email: "rose@example.com",
    answers: {
      displayName: "Rose",
      ageRange: "18-19",
      major: "英语",
      coreValues: ["真诚", "同理心", "自由"],
      hobbies: ["阅读", "旅行", "音乐"],
      weekendPlan: "citywalk",
      datePreference: "open",
      communicationStyle: "fast",
      futurePlan: "想做国际教育方向，优先找能互相支持的伴侣",
      relationshipValueScore: 3,
    },
  },
  {
    key: "synth-sia",
    email: "sia@example.com",
    answers: {
      displayName: "Sia",
      ageRange: "20-22",
      major: "心理学",
      coreValues: ["同理心", "真诚", "成长"],
      hobbies: ["阅读", "citywalk", "音乐"],
      weekendPlan: "learning",
      datePreference: "serious",
      communicationStyle: "slow",
      futurePlan: "读研深造，重视高质量沟通与边界感",
      relationshipValueScore: 6,
    },
  },
  {
    key: "synth-mona",
    email: "mona@example.com",
    answers: {
      displayName: "Mona",
      ageRange: "23-25",
      major: "市场营销",
      coreValues: ["成长", "自由", "上进"],
      hobbies: ["咖啡", "摄影", "看展"],
      weekendPlan: "citywalk",
      datePreference: "slow",
      communicationStyle: "balanced",
      futurePlan: "希望在一线城市做品牌方向，接受异地阶段",
      relationshipValueScore: 4,
    },
  },
];

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
    valueOverlap * 32 +
      hobbyOverlap * 22 +
      planScore * 12 +
      communicationFit * 12 +
      weekendFit * 10 +
      dateFit * 8 +
      (1 - Math.abs(current.relationshipValueScore - candidate.relationshipValueScore) / 6) *
        4,
  );

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

export function fallbackCandidates(currentUserId: string): MatchCandidate[] {
  return SYNTHETIC_TEMPLATES.filter((profile) => profile.key !== currentUserId).map(
    (profile) => ({
      userId: profile.key,
      email: profile.email,
      answers: profile.answers,
    }),
  );
}

export function ensureSyntheticCandidatePool(
  currentUserId: string,
  existing: MatchCandidate[],
  minCount = 10,
) {
  const used = new Set(existing.map((item) => item.userId));
  const pool = [...existing];

  for (const profile of SYNTHETIC_TEMPLATES) {
    if (pool.length >= minCount) {
      break;
    }

    if (profile.key === currentUserId || used.has(profile.key)) {
      continue;
    }

    pool.push({
      userId: profile.key,
      email: profile.email,
      answers: profile.answers,
    });
    used.add(profile.key);
  }

  return pool;
}

export function buildFitAdvice(
  current: QuestionnaireAnswers,
  partner: QuestionnaireAnswers,
) {
  const idealPartnerType =
    current.relationshipValueScore >= 5
      ? "你更适合长期关系导向、沟通稳定且有责任感的人"
      : "你更适合节奏轻松、允许先做朋友再深入了解的人";

  const starterTopics = [
    `从共同兴趣切入：${partner.hobbies.slice(0, 2).join("、") || "citywalk、咖啡"}`,
    `聊未来规划交集：${partner.futurePlan.slice(0, 18) || "毕业后发展城市与职业方向"}`,
    `第一次约会建议：${partner.weekendPlan === "citywalk" ? "咖啡+散步" : "共同体验活动"}`,
  ];

  const boundaryHints = [
    "先明确关系目标节奏，不要跳过边界讨论",
    "高频聊天前先确认对方沟通偏好与时间安排",
    "涉及未来城市选择时，先讨论阶段性方案再给承诺",
  ];

  return {
    idealPartnerType,
    starterTopics,
    boundaryHints,
  };
}
