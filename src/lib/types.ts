export type QuestionnaireAnswers = {
  displayName: string;
  ageRange: string;
  major: string;
  coreValues: string[];
  hobbies: string[];
  weekendPlan: string;
  datePreference: string;
  communicationStyle: string;
  futurePlan: string;
  relationshipValueScore: number;
};

export type MatchCandidate = {
  userId: string;
  email: string;
  answers: QuestionnaireAnswers;
};

export type AgentEvaluation = {
  agentId: string;
  agentName: string;
  focus: string;
  candidateUserId: string;
  candidateName: string;
  score: number;
  rationale: string;
  round: number;
  voteWeight: number;
};

export type MatchArena = {
  track: string;
  lane: string;
  runId: string;
  cycleMinutes: number;
  rounds: number;
  logs: string[];
  agentEvaluations: AgentEvaluation[];
  consensus: {
    winnerUserId: string;
    winnerName: string;
    score: number;
    runnerUpUserId: string | null;
    gap: number;
  };
  verificationHash: string;
  verificationPayload: Record<string, unknown>;
};

export type MatchDecision = {
  candidateUserId: string;
  candidateName: string;
  maskedEmail: string;
  compatibilityScore: number;
  summary: string;
  reason: string[];
  thoughtProcess: string;
  arena: MatchArena;
  decisionJson: Record<string, unknown>;
};
