"use client";

import useExamControllerResult from '@/app/hooks/useExamControllerResult';

type UseExamReturnFacadeArgs<TMeta, TState, TSetters, TActions> = {
  meta: TMeta;
  state: TState;
  setters: TSetters;
  actions: TActions;
};

export default function useExamReturnFacade<TMeta, TState, TSetters, TActions>({
  meta,
  state,
  setters,
  actions,
}: UseExamReturnFacadeArgs<TMeta, TState, TSetters, TActions>) {
  return useExamControllerResult({
    meta,
    state,
    setters,
    actions,
  });
}
