type RemedialMode = 'wrong_only' | 'wrong_similar' | 'topic_based';

type QuestionTopicData = {
  id: number;
  mapels?: string[];
  babs?: string[];
  sub_babs?: string[];
  is_hidden?: boolean;
};

export type RemedialQuestionLike = {
  questionId: number;
  attempts: number;
  incorrect: number;
  correct: number;
  wrongRate: number;
  question?: QuestionTopicData;
  participantKeys?: string[];
};

type BuildRemedialQuestionPoolArgs = {
  mode: RemedialMode;
  studentKeys: string[];
  remedialCandidates: RemedialQuestionLike[];
  questionPool: RemedialQuestionLike[];
};

type TopicSet = {
  mapels: Set<string>;
  babs: Set<string>;
  subBabs: Set<string>;
};

function normalizeList(values?: string[]): string[] {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function collectTopics(items: RemedialQuestionLike[]): TopicSet {
  const topics: TopicSet = { mapels: new Set(), babs: new Set(), subBabs: new Set() };
  for (const item of items) {
    for (const value of normalizeList(item.question?.mapels)) topics.mapels.add(value);
    for (const value of normalizeList(item.question?.babs)) topics.babs.add(value);
    for (const value of normalizeList(item.question?.sub_babs)) topics.subBabs.add(value);
  }
  return topics;
}

function topicMatchScore(item: RemedialQuestionLike, topics: TopicSet): number {
  let score = 0;
  for (const value of normalizeList(item.question?.sub_babs)) if (topics.subBabs.has(value)) score += 3;
  for (const value of normalizeList(item.question?.babs)) if (topics.babs.has(value)) score += 2;
  for (const value of normalizeList(item.question?.mapels)) if (topics.mapels.has(value)) score += 1;
  return score;
}

function sortByPriority<T extends RemedialQuestionLike>(items: T[], topics: TopicSet, wrongIds: Set<number>): T[] {
  return [...items].sort((a, b) => {
    const wrongDelta = Number(wrongIds.has(b.questionId)) - Number(wrongIds.has(a.questionId));
    if (wrongDelta !== 0) return wrongDelta;

    const topicDelta = topicMatchScore(b, topics) - topicMatchScore(a, topics);
    if (topicDelta !== 0) return topicDelta;

    return b.wrongRate - a.wrongRate || b.incorrect - a.incorrect || b.attempts - a.attempts || a.questionId - b.questionId;
  });
}

function dedupeByQuestionId<T extends RemedialQuestionLike>(items: T[]): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.questionId)) continue;
    seen.add(item.questionId);
    result.push(item);
  }
  return result;
}

export function buildRemedialQuestionPool({
  mode,
  studentKeys,
  remedialCandidates,
  questionPool,
}: BuildRemedialQuestionPoolArgs): RemedialQuestionLike[] {
  const selectedStudentKeys = new Set(studentKeys);
  const wrongQuestions = remedialCandidates.filter((item) =>
    item.participantKeys?.some((key) => selectedStudentKeys.has(key))
  );
  const wrongIds = new Set(wrongQuestions.map((item) => item.questionId));

  if (mode === 'wrong_only') {
    return sortByPriority(dedupeByQuestionId(wrongQuestions), collectTopics(wrongQuestions), wrongIds);
  }

  const weakTopics = collectTopics(wrongQuestions);
  const expandedPool = dedupeByQuestionId([...wrongQuestions, ...questionPool]).filter((item) => item.question && !item.question.is_hidden);

  if (mode === 'wrong_similar') {
    const similarQuestions = expandedPool.filter((item) => wrongIds.has(item.questionId) || topicMatchScore(item, weakTopics) > 0);
    return sortByPriority(similarQuestions, weakTopics, wrongIds);
  }

  const topicQuestions = expandedPool.filter((item) => topicMatchScore(item, weakTopics) > 0);
  return sortByPriority(topicQuestions, weakTopics, wrongIds);
}
