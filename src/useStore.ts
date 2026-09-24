import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Amendment,
  FieldVerdict,
  LabelField,
  LabelInfo,
  Specimen,
  StoreData,
} from "./types";
import {
  EMPTY_LABEL,
  isCabinetFree,
  issueAccessionNo,
  loadStore,
  makeAmendment,
  makeReview,
  normalizeCabinet,
  nowText,
  resetStore,
  saveStore,
} from "./store";

export interface InitialReviewInput {
  reviewer: string;
  /** 校录判定：四个标签字段逐项 match/mismatch（与页面状态分开维护） */
  verdicts: Record<LabelField, FieldVerdict>;
  cabinetOk: boolean;
  note?: string;
}

function snapshotEqual(a: LabelInfo, b: LabelInfo): boolean {
  return (
    a.species === b.species &&
    a.location === b.location &&
    a.altitude === b.altitude &&
    a.collector === b.collector &&
    a.cabinet === b.cabinet
  );
}

export function useStore() {
  const [data, setData] = useState<StoreData>(() => loadStore());
  const timer = useRef<number | undefined>(undefined);

  // 队列、地点卡、柜位记录、详情共用同一份本地数据，改动即持久化，重开可继续
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => saveStore(data), 120);
  }, [data]);

  const mutate = useCallback((fn: (draft: StoreData) => void) => {
    setData((prev) => {
      const next: StoreData = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const updateSpecimen = useCallback(
    (id: string, fn: (s: Specimen) => void) => {
      mutate((d) => {
        const s = d.specimens.find((x) => x.id === id);
        if (s) fn(s);
      });
    },
    [mutate]
  );

  // ---------- 录入侧 ----------

  /** 标本员按采集号领取待转录标本（领取后别人不能再领） */
  const claim = useCallback(
    (id: string, assignee: string) => {
      if (!assignee.trim()) return;
      updateSpecimen(id, (s) => {
        if (s.status !== "pending") return;
        s.status = "transcribing";
        s.assignee = assignee.trim();
        s.assignedAt = nowText();
        if (snapshotEqual(s.draft, EMPTY_LABEL)) s.draft = { ...EMPTY_LABEL };
      });
    },
    [updateSpecimen]
  );

  /** 保存草稿（不改变页面状态，也不占用任何柜位） */
  const saveDraft = useCallback(
    (id: string, patch: Partial<LabelInfo>) => {
      updateSpecimen(id, (s) => {
        if (s.status !== "transcribing" && s.status !== "rejected") return;
        s.draft = { ...s.draft, ...patch };
      });
    },
    [updateSpecimen]
  );

  /** 录入完成，提交复核：状态转“待复核”，柜位仍未占用 */
  const submitForReview = useCallback(
    (id: string) => {
      let ok = false;
      updateSpecimen(id, (s) => {
        if (s.status !== "transcribing" && s.status !== "rejected") return;
        const filled =
          s.draft.species.trim() &&
          s.draft.location.trim() &&
          s.draft.altitude.trim() &&
          s.draft.collector.trim() &&
          s.draft.cabinet.trim();
        if (!filled) return;
        s.draft.cabinet = normalizeCabinet(s.draft.cabinet);
        s.status = "review";
        s.submittedAt = nowText();
        ok = true;
      });
      return ok;
    },
    [updateSpecimen]
  );

  // ---------- 复核侧（校录判定与页面状态分开维护） ----------

  /**
   * 初核：任一字段与标签照片不符，或柜位不可用 → 退回，保留旧版草稿；
   * 全部一致且柜位可用 → 发放馆藏号、按当前值锁定原字段、柜位正式占用。
   */
  const reviewInitial = useCallback(
    (id: string, input: InitialReviewInput) => {
      mutate((d) => {
        const s = d.specimens.find((x) => x.id === id);
        if (!s || s.status !== "review") return;
        const allMatch = (Object.keys(input.verdicts) as LabelField[]).every(
          (k) => input.verdicts[k] === "match"
        );
        const approved = allMatch && input.cabinetOk;

        s.reviews.push(
          makeReview({
            kind: "initial",
            reviewer: input.reviewer.trim() || "复核员",
            result: approved ? "approve" : "reject",
            verdicts: { ...input.verdicts },
            cabinetOk: input.cabinetOk,
            note: input.note?.trim(),
            changed: { ...s.draft },
          })
        );

        if (approved) {
          s.accessionNo = issueAccessionNo(d);
          s.archivedAt = nowText();
          s.locked = { ...s.draft, cabinet: normalizeCabinet(s.draft.cabinet) };
          s.draft = { ...s.locked };
          s.status = "archived";
          s.lastRejectNote = undefined;
        } else {
          // 退回：保留上一版录入内容，只改页面状态与提示
          s.status = "rejected";
          const bad: string[] = [];
          (Object.keys(input.verdicts) as LabelField[]).forEach((k) => {
            if (input.verdicts[k] === "mismatch") bad.push(k);
          });
          if (!input.cabinetOk) bad.push("cabinet");
          s.lastRejectNote =
            input.note?.trim() ||
            `退回：${bad.join("、")} 与标签照片不符或柜位不可用，旧版已保留，请核对后重新提交。`;
        }
      });
    },
    [mutate]
  );

  // ---------- 馆藏后变更（物种 / 柜位）：写原因、重新复核，旧柜位暂不释放 ----------

  const requestAmendment = useCallback(
    (
      id: string,
      field: LabelField | "cabinet",
      newValue: string,
      reason: string,
      requestedBy: string
    ): boolean => {
      let ok = false;
      mutate((d) => {
        const s = d.specimens.find((x) => x.id === id);
        if (!s || s.status !== "archived" || !s.locked) return;
        const value =
          field === "cabinet" ? normalizeCabinet(newValue) : newValue.trim();
        if (!value || !reason.trim() || !requestedBy.trim()) return;
        const oldValue = s.locked[field];
        if (value === oldValue) return;
        // 同字段已有待复核变更时不重复发起
        if (
          s.amendments.some(
            (a) => a.field === field && a.status === "pending_review"
          )
        )
          return;
        const amendment: Amendment = makeAmendment({
          specimenId: id,
          field,
          oldValue,
          newValue: value,
          reason: reason.trim(),
          requestedBy: requestedBy.trim(),
        });
        s.amendments.push(amendment);
        ok = true;
      });
      return ok;
    },
    [mutate]
  );

  const reviewAmendment = useCallback(
    (
      specimenId: string,
      amendmentId: string,
      approve: boolean,
      reviewer: string,
      note?: string
    ) => {
      mutate((d) => {
        const s = d.specimens.find((x) => x.id === specimenId);
        if (!s || !s.locked) return;
        const a = s.amendments.find((x) => x.id === amendmentId);
        if (!a || a.status !== "pending_review") return;

        // 柜位变更复核：新柜位必须空闲，且不能落在暂留名单中
        let cabinetOk = true;
        if (approve && a.field === "cabinet") {
          cabinetOk =
            isCabinetFree(d.specimens, a.newValue, s.id) &&
            !d.heldCabinets.some((h) => h.cell === normalizeCabinet(a.newValue));
        }
        const pass = approve && cabinetOk;

        a.status = pass ? "approved" : "rejected";
        s.reviews.push(
          makeReview({
            kind: "amendment",
            reviewer: reviewer.trim() || "复核员",
            result: pass ? "approve" : "reject",
            verdicts:
              a.field === "cabinet" ? undefined : { [a.field]: "match" as FieldVerdict },
            cabinetOk: a.field === "cabinet" ? cabinetOk : undefined,
            note: note?.trim(),
            amendmentId: a.id,
            reason: a.reason,
            before: { [a.field]: a.oldValue } as Partial<LabelInfo>,
            changed: { [a.field]: a.newValue } as Partial<LabelInfo>,
          })
        );

        if (pass) {
          const oldCell = s.locked.cabinet;
          s.locked = { ...s.locked, [a.field]: a.newValue };
          s.draft = { ...s.locked };
          // 柜位变更：原柜位暂不释放，进入暂留名单
          if (a.field === "cabinet" && oldCell && oldCell !== a.newValue) {
            if (!d.heldCabinets.some((h) => h.cell === oldCell)) {
              d.heldCabinets.push({
                cell: oldCell,
                specimenId: s.id,
                since: nowText(),
                reason: `调柜至 ${a.newValue}，原柜位暂留待实物核对`,
              });
            }
          }
        }
      });
    },
    [mutate]
  );

  /** 人工确认实物已搬走后，释放暂留柜位（系统不自动释放） */
  const releaseHeldCabinet = useCallback((cell: string) => {
    mutate((d) => {
      d.heldCabinets = d.heldCabinets.filter((h) => h.cell !== cell);
    });
  }, [mutate]);

  const resetAll = useCallback(() => setData(resetStore()), []);

  return {
    data,
    claim,
    saveDraft,
    submitForReview,
    reviewInitial,
    requestAmendment,
    reviewAmendment,
    releaseHeldCabinet,
    resetAll,
  };
}
