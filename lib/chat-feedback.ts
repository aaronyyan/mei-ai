export type FeedbackValue = 'up' | 'down';

export function resolveFeedbackValue(
  currentValue: FeedbackValue | null | undefined,
  nextValue: FeedbackValue,
) {
  return currentValue === nextValue ? null : nextValue;
}
