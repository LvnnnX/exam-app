"use client";

type UseExamControllerAssemblyArgs<TState, TSetters, TActions> = {
  state: TState;
  setters: TSetters;
  actions: TActions;
};

export default function useExamControllerAssembly<TState, TSetters, TActions>({
  state,
  setters,
  actions,
}: UseExamControllerAssemblyArgs<TState, TSetters, TActions>) {
  return {
    state,
    setters,
    actions,
  };
}
