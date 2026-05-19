"use client";

type UseExamPublicPayloadArgs<TState, TSetters, TActions> = {
  state: TState;
  setters: TSetters;
  actions: TActions;
};

export default function useExamPublicPayload<TState, TSetters, TActions>({
  state,
  setters,
  actions,
}: UseExamPublicPayloadArgs<TState, TSetters, TActions>) {
  return {
    state,
    setters,
    actions,
  };
}
