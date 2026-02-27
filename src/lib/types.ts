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

export type MatchDecision = {
  candidateUserId: string;
  candidateName: string;
  maskedEmail: string;
  compatibilityScore: number;
  summary: string;
  reason: string[];
  thoughtProcess: string;
  decisionJson: Record<string, unknown>;
};
