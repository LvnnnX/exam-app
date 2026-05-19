"use client";

type UseExamControllerResultArgs<TMeta, TState, TSetters, TActions> = {
  meta: TMeta;
  state: TState;
  setters: TSetters;
  actions: TActions;
};

export default function useExamControllerResult<TMeta, TState, TSetters, TActions>({
  meta,
  state,
  setters,
  actions,
}: UseExamControllerResultArgs<TMeta, TState, TSetters, TActions>) {
  return {
    meta,
    state,
    setters,
    actions,
  };
}
