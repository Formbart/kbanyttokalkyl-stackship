import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  initialState,
  surveySignature,
  type AppState,
  type CostSheet,
  type FollowUp,
  type StaffChange,
  type StaffToday,
  type Survey,
  type SurveyResult,
} from "./types";


interface StoreValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateProject: (patch: Partial<AppState["project"]>) => void;
  updateSheet: <K extends "costToday" | "costChange">(
    key: K,
    patch: Partial<AppState[K]>,
  ) => void;
  setQualRating: (index: number, current: number, expected: number) => void;
  setFollowUp: (index: number, patch: Partial<FollowUp>) => void;
  setSurvey: (index: number, survey: Survey | null) => void;
  setSurveyResult: (index: number, result: SurveyResult | null) => void;

  reset: () => void;
  resetToken: number;
}


const StoreContext = createContext<StoreValue | null>(null);

export function NyttokalkylProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());
  const [resetToken, setResetToken] = useState(0);

  const updateProject = useCallback(
    (patch: Partial<AppState["project"]>) =>
      setState((s) => ({ ...s, project: { ...s.project, ...patch } })),
    [],
  );

  const updateSheet = useCallback(
    <K extends "costToday" | "costChange">(key: K, patch: Partial<AppState[K]>) =>
      setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }) as AppState),
    [],
  );

  const setQualRating = useCallback(
    (index: number, current: number, expected: number) =>
      setState((s) => ({
        ...s,
        qualRatings: { ...s.qualRatings, [index]: { current, expected } },
      })),
    [],
  );

  const setFollowUp = useCallback(
    (index: number, patch: Partial<FollowUp>) =>
      setState((s) => ({
        ...s,
        followUp: {
          ...s.followUp,
          [index]: {
            effektmal: "",
            syfte: "",
            nar: "",
            hur: "",
            vad: "",
            ansvarig: "",
            resultat: "",
            atgard: "",
            ...s.followUp[index],
            ...patch,
          },
        },
      })),
    [],
  );

  const setSurvey = useCallback(
    (index: number, survey: Survey | null) =>
      setState((s) => {
        const next = { ...s.surveys };
        const nextResults = { ...s.surveyResults };
        if (survey === null) {
          delete next[index];
          delete nextResults[index];
        } else {
          next[index] = survey;
          const existing = nextResults[index];
          if (existing && existing.signature !== surveySignature(survey)) {
            delete nextResults[index];
            toast.info(
              "Enkätens frågor har ändrats — det importerade resultatet togs bort. Importera resultatfilen igen.",
            );
          }
        }
        return { ...s, surveys: next, surveyResults: nextResults };
      }),
    [],
  );

  const setSurveyResult = useCallback(
    (index: number, result: SurveyResult | null) =>
      setState((s) => {
        const next = { ...s.surveyResults };
        if (result === null) delete next[index];
        else next[index] = result;
        return { ...s, surveyResults: next };
      }),
    [],
  );


  const reset = useCallback(() => {
    setState(initialState());
    setResetToken((t) => t + 1);
  }, []);

  const value = useMemo(
    () => ({
      state,
      setState,
      updateProject,
      updateSheet,
      setQualRating,
      setFollowUp,
      setSurvey,
      reset,
      resetToken,
    }),
    [
      state,
      resetToken,
      updateProject,
      updateSheet,
      setQualRating,
      setFollowUp,
      setSurvey,
      reset,
    ],
  );


  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useNyttokalkyl(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx)
    throw new Error("useNyttokalkyl måste användas inom NyttokalkylProvider");
  return ctx;
}

export type TodaySheet = CostSheet<StaffToday>;
export type ChangeSheet = CostSheet<StaffChange>;
