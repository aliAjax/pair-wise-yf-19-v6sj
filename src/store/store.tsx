import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActionResult, DomainState, FieldData } from "../types";
import { loadState, resetState, saveState } from "./seed";
import {
  claim as doClaim,
  requestAmendment as doRequestAmendment,
  reviewAmendment as doReviewAmendment,
  saveDraft as doSaveDraft,
  submitDraft as doSubmitDraft,
  submitReview as doSubmitReview,
  type AmendInput,
  type AmendReviewInput,
  type ReviewInput,
} from "./logic";

type ApplyResult = DomainState | ActionResult;

interface StoreContextValue {
  state: DomainState;
  /** 当前登录工作人员（录入与复核分离的身份依据） */
  staff: string;
  setStaff: (name: string) => void;
  apply: (result: ApplyResult) => ActionResult;
  claim: (id: string) => ActionResult;
  saveDraft: (id: string, data: FieldData) => ActionResult;
  submitDraft: (id: string) => ActionResult;
  submitReview: (id: string, input: ReviewInput) => ActionResult;
  requestAmendment: (id: string, input: AmendInput) => ActionResult;
  reviewAmendment: (specimenId: string, amendmentId: string, input: AmendReviewInput) => ActionResult;
  resetAll: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DomainState>(() => loadState());
  const [staff, setStaff] = useState<string>(() => {
    try {
      return localStorage.getItem("herbarium.staff") ?? "";
    } catch {
      return "";
    }
  });

  const persist = useCallback((next: DomainState) => {
    setState(next);
    saveState(next);
  }, []);

  const apply = useCallback(
    (result: ApplyResult): ActionResult => {
      if ("ok" in result) return result;
      persist(result);
      return { ok: true };
    },
    [persist],
  );

  const updateStaff = useCallback((name: string) => {
    setStaff(name);
    try {
      localStorage.setItem("herbarium.staff", name);
    } catch {
      // 忽略
    }
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      staff,
      setStaff: updateStaff,
      apply,
      claim: (id) => apply(doClaim(state, id, staff)),
      saveDraft: (id, data) => apply(doSaveDraft(state, id, staff, data)),
      submitDraft: (id) => apply(doSubmitDraft(state, id, staff)),
      submitReview: (id, input) => apply(doSubmitReview(state, id, input)),
      requestAmendment: (id, input) => apply(doRequestAmendment(state, id, staff, input)),
      reviewAmendment: (specimenId, amendmentId, input) =>
        apply(doReviewAmendment(state, specimenId, amendmentId, input)),
      resetAll: () => persist(resetState()),
    }),
    [state, staff, updateStaff, apply, persist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
