"use client";

import useExamControllerAssembly from '@/app/hooks/useExamControllerAssembly';
import useExamReturnFacade from '@/app/hooks/useExamReturnFacade';

type UseExamPublicApiArgs<TMeta, TState, TSetters, TActions> = {
  meta: TMeta;
  payload: {
    state: TState;
    setters: TSetters;
    actions: TActions;
  };
};

export default function useExamPublicApi<TMeta, TState, TSetters, TActions>({
  meta,
  payload,
}: UseExamPublicApiArgs<TMeta, TState, TSetters, TActions>) {
  const assembly = useExamControllerAssembly(payload);

  return useExamReturnFacade({
    meta,
    state: assembly.state,
    setters: assembly.setters,
    actions: assembly.actions,
  });
}
