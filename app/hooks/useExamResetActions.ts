"use client";

type UseExamResetActionsArgs = {
  surrender: () => Promise<void>;
  restart: () => void;
};

export default function useExamResetActions({
  surrender,
  restart,
}: UseExamResetActionsArgs) {
  return {
    surrender,
    restart,
  };
}
