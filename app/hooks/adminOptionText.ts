import { type RawQuestion } from '@/lib/questions';

type OptionLabel = 'a' | 'b' | 'c' | 'd' | 'e';

export function getOptionText(question: RawQuestion, label: OptionLabel): string {
  switch (label) {
    case 'a': return question.option_a;
    case 'b': return question.option_b;
    case 'c': return question.option_c;
    case 'd': return question.option_d;
    case 'e': return question.option_e;
  }
}

export function getCorrectOptionText(question: RawQuestion): string {
  const label = question.correct_answer.toLowerCase();
  if (label === 'a' || label === 'b' || label === 'c' || label === 'd' || label === 'e') {
    return getOptionText(question, label);
  }
  return '';
}
