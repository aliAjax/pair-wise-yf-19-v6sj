import type {
  ActionResult,
  Amendment,
  DomainState,
  FieldData,
  FieldKey,
  ReviewRecord,
  Specimen,
  Verdict,
} from "../types";

/* ---------------- 文本归一化：校录判定时的比对口径 ---------------- */

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[，。；、：:;,.·・]/g, "")
    .replace(/[\s ]+/g, "")
    .trim();
}

/** 海拔允许 “海拔 640 m / 640米 / 640m” 互判一致，仍以数值与纸签一致为准 */
export function normalizeAltitude(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/海拔|高度|米|m\s*$|\s/g, "")
    .trim();
}

export function fieldEquals(key: FieldKey, a: string, b: string): boolean {
  if (key === "altitude") return normalizeAltitude(a) === normalizeAltitude(b);
  return normalizeText(a) === normalizeText(b);
}

export function compareFields(typed: FieldData, label: FieldData): Verdict[] {
  return (Object.keys(label) as FieldKey[]).map((field) => ({
    field,
    match: fieldEquals(field, typed[field], label[field]),
  }));
}

/* ---------------- 柜位登记：占用只从“锁定值”推导，绝不预占 ---------------- */

export interface CabinetInfo {
  code: string;
  status: "occupied" | "incoming" | "free";
  specimenId?: string;
  collectionNo?: string;
  accessionNo?: string;
  /** 占用此柜的标本有一条待复核的迁出申请，审核期间原柜位不释放 */
  movingOut?: boolean;
  /** 待复核的拟调入柜位（不预占，仅提示） */
  incomingFrom?: string;
}

export function pendingCabinetAmendment(s: Specimen): Amendment | undefined {
  return s.amendments.find((a) => a.kind === "cabinet" && a.status === "review");
}

export function cabinetRegistry(state: DomainState): Map<string, CabinetInfo> {
  const map = new Map<string, CabinetInfo>();
  state.cabinets.forEach((code) => map.set(code, { code, status: "free" }));

  state.specimens.forEach((s) => {
    if (s.status !== "archived" || !s.locked) return;
    const occupied = map.get(s.locked.cabinet);
    if (occupied) {
      occupied.status = "occupied";
      occupied.specimenId = s.id;
      occupied.collectionNo = s.collectionNo;
      occupied.accessionNo = s.accessionNo;
      const moving = pendingCabinetAmendment(s);
      if (moving) occupied.movingOut = true;
    }
  });

  // 拟调入柜位只在空闲柜上挂提示；已占用柜保持 occupied，绝不能被覆盖
  state.specimens.forEach((s) => {
    const moving = pendingCabinetAmendment(s);
    if (!moving) return;
    const target = map.get(moving.newValue);
    if (target && target.status === "free") {
      target.status = "incoming";
      target.incomingFrom = s.collectionNo;
    }
  });

  return map;
}

/** 建档复核通过瞬间检查：柜位必须存在、且未被已建档标本占用 */
export function checkCabinetForArchive(state: DomainState, code: string): string | null {
  if (!state.cabinets.includes(code)) return `柜位 ${code} 不在柜位登记表中`;
  const info = cabinetRegistry(state).get(code);
  if (info && info.status === "occupied") {
    return `柜位 ${code} 已被馆藏号 ${info.accessionNo}（${info.collectionNo}）占用，无法发放馆藏号`;
  }
  return null;
}

/* ---------------- 操作：每个函数先校验、再返回不可变新状态 ---------------- */

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const withSpecimen = (
  state: DomainState,
  id: string,
  fn: (s: Specimen) => ActionResult,
): { state: DomainState } | ActionResult => {
  const idx = state.specimens.findIndex((s) => s.id === id);
  if (idx < 0) return { ok: false, error: "标本不存在" };
  const next = clone(state);
  const result = fn(next.specimens[idx]);
  if (!result.ok) return result;
  return { state: next };
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function claim(state: DomainState, id: string, staff: string): DomainState | ActionResult {
  const ret = withSpecimen(state, id, (s) => {
    if (s.status !== "waiting") return { ok: false, error: "该标本已被领取" };
    if (!staff.trim()) return { ok: false, error: "请先填写当前工作人员姓名" };
    s.status = "draft";
    s.claimedBy = staff.trim();
    s.claimedAt = Date.now();
    return { ok: true };
  });
  return "ok" in ret ? ret : ret.state;
}

export function saveDraft(
  state: DomainState,
  id: string,
  staff: string,
  data: FieldData,
): DomainState | ActionResult {
  const ret = withSpecimen(state, id, (s) => {
    if (!staff.trim()) return { ok: false, error: "请先填写当前工作人员姓名" };
    if (s.status === "waiting") {
      s.status = "draft";
      s.claimedBy = staff.trim();
      s.claimedAt = Date.now();
    }
    if (s.status !== "draft" && s.status !== "returned") {
      return { ok: false, error: "当前状态不能保存转录稿" };
    }
    if (s.claimedBy && s.claimedBy !== staff.trim()) {
      return { ok: false, error: `该标本由 ${s.claimedBy} 领取，不能代为保存` };
    }
    s.draft = { ...data };
    return { ok: true };
  });
  return "ok" in ret ? ret : ret.state;
}

export function submitDraft(
  state: DomainState,
  id: string,
  staff: string,
): DomainState | ActionResult {
  const ret = withSpecimen(state, id, (s) => {
    if (s.status !== "draft" && s.status !== "returned") {
      return { ok: false, error: "只有转录中的标本可以提交复核" };
    }
    if (!s.draft) return { ok: false, error: "转录稿为空" };
    if (s.claimedBy !== staff.trim()) {
      return { ok: false, error: `录入人须为领取人 ${s.claimedBy ?? "（未记录）"}` };
    }
    const missing = (Object.keys(s.draft) as FieldKey[]).filter((k) => !s.draft![k].trim());
    if (missing.length) return { ok: false, error: "五个字段均须填写后才能提交复核" };
    s.status = "review";
    s.submittedAt = Date.now();
    return { ok: true };
  });
  return "ok" in ret ? ret : ret.state;
}

export interface ReviewInput {
  reviewer: string;
  verdicts: Verdict[];
  note?: string;
}

export function submitReview(
  state: DomainState,
  id: string,
  input: ReviewInput,
): DomainState | ActionResult {
  const idx = state.specimens.findIndex((s) => s.id === id);
  if (idx < 0) return { ok: false, error: "标本不存在" };

  const specimen = state.specimens[idx];
  if (specimen.status !== "review") return { ok: false, error: "该标本不在待复核队列" };
  if (!input.reviewer.trim()) return { ok: false, error: "请填写复核人" };
  if (input.reviewer.trim() === specimen.claimedBy) {
    return { ok: false, error: "录入与复核须分开：复核人不能是录入人本人" };
  }
  if (input.verdicts.length !== 5 || input.verdicts.some((v) => typeof v.match !== "boolean")) {
    return { ok: false, error: "须对五个字段逐项给出判定" };
  }
  if (!specimen.draft) return { ok: false, error: "缺少转录稿" };

  const approved = input.verdicts.every((v) => v.match);

  if (approved) {
    // 五项判定全部与标签照片一致，通过瞬间要登记的柜位即纸签柜位。
    // 必须以标签值为准（而非转录稿），防止改判绕过占用检查；柜位不预占，此刻才校验。
    const cabinetError = checkCabinetForArchive(state, specimen.label.cabinet.trim());
    if (cabinetError) return { ok: false, error: cabinetError };
    // 双保险：一致结论下转录柜位理应与纸签一致
    if (!fieldEquals("cabinet", specimen.draft.cabinet, specimen.label.cabinet)) {
      return { ok: false, error: "柜位判定为一致，但转录值与纸签不符" };
    }
  }

  const next = clone(state);
  const s = next.specimens[idx];
  const record: ReviewRecord = {
    id: uid("rv"),
    reviewer: input.reviewer.trim(),
    at: Date.now(),
    result: approved ? "approved" : "returned",
    verdicts: clone(input.verdicts),
    note: input.note?.trim() || undefined,
    snapshot: clone(s.draft!),
  };
  s.reviews.push(record);

  if (approved) {
    // 以标签照片为准锁定（归一化空格）；柜位此刻才登记占用
    const locked = clone(specimen.label);
    (Object.keys(locked) as FieldKey[]).forEach((k) => (locked[k] = locked[k].trim()));
    next.counter += 1;
    s.accessionNo = `HN-${String(next.counter).padStart(4, "0")}`;
    s.locked = locked;
    s.status = "archived";
    s.versions.push({
      no: 1,
      at: record.at,
      data: clone(locked),
      note: "建档锁定",
    });
  } else {
    // 退回：保留旧稿（draft 不动），回到转录人手中修改
    s.status = "returned";
  }
  return next;
}

export interface AmendInput {
  kind: "species" | "cabinet";
  newValue: string;
  reason: string;
}

export function requestAmendment(
  state: DomainState,
  id: string,
  staff: string,
  input: AmendInput,
): DomainState | ActionResult {
  const ret = withSpecimen(state, id, (s) => {
    if (!staff.trim()) return { ok: false, error: "请先填写当前工作人员姓名" };
    if (s.status !== "archived" || !s.locked) return { ok: false, error: "只有已建档标本可以申请变更" };
    if (s.amendments.some((a) => a.status === "review")) {
      return { ok: false, error: "已有待复核的变更申请，须先结案" };
    }
    const value = input.newValue.trim();
    if (!value) return { ok: false, error: "请填写变更后的内容" };
    if (!input.reason.trim()) return { ok: false, error: "变更必须写明原因" };
    const current = input.kind === "species" ? s.locked.species : s.locked.cabinet;
    if (fieldEquals(input.kind === "species" ? "species" : "cabinet", value, current)) {
      return { ok: false, error: "新值与锁定值相同，无需变更" };
    }
    if (input.kind === "cabinet" && !state.cabinets.includes(value)) {
      return { ok: false, error: `柜位 ${value} 不在柜位登记表中` };
    }
    const amendment: Amendment = {
      id: uid("am"),
      kind: input.kind,
      oldValue: current,
      newValue: value,
      reason: input.reason.trim(),
      proposer: staff.trim(),
      createdAt: Date.now(),
      status: "review",
    };
    s.amendments.push(amendment);
    // 原柜位不释放、新柜位不预占：占用状态由 locked 推导，此处不改 locked
    return { ok: true };
  });
  return "ok" in ret ? ret : ret.state;
}

export interface AmendReviewInput {
  reviewer: string;
  approve: boolean;
  note?: string;
}

export function reviewAmendment(
  state: DomainState,
  specimenId: string,
  amendmentId: string,
  input: AmendReviewInput,
): DomainState | ActionResult {
  const idx = state.specimens.findIndex((s) => s.id === specimenId);
  if (idx < 0) return { ok: false, error: "标本不存在" };
  const specimen = state.specimens[idx];
  const amendment = specimen.amendments.find((a) => a.id === amendmentId);
  if (!amendment) return { ok: false, error: "变更申请不存在" };
  if (amendment.status !== "review") return { ok: false, error: "该变更已结案" };
  if (!input.reviewer.trim()) return { ok: false, error: "请填写复核人" };
  if (input.reviewer.trim() === amendment.proposer) {
    return { ok: false, error: "变更申请人不能复核自己的申请" };
  }
  if (input.approve && amendment.kind === "cabinet") {
    // 通过瞬间才登记新柜位；此时原柜位仍登记在 locked 上，天然不释放到通过之前
    const info = cabinetRegistry(state).get(amendment.newValue);
    if (!info) return { ok: false, error: `柜位 ${amendment.newValue} 不在柜位登记表中` };
    if (info.status === "occupied") {
      return {
        ok: false,
        error: `柜位 ${amendment.newValue} 已被馆藏号 ${info.accessionNo}（${info.collectionNo}）占用`,
      };
    }
  }

  const next = clone(state);
  const s = next.specimens[idx];
  const am = s.amendments.find((a) => a.id === amendmentId)!;
  am.status = input.approve ? "approved" : "rejected";
  am.reviewer = input.reviewer.trim();
  am.reviewedAt = Date.now();
  am.reviewNote = input.note?.trim() || undefined;

  if (input.approve && s.locked) {
    const newData: FieldData = { ...s.locked };
    if (am.kind === "species") newData.species = am.newValue;
    else newData.cabinet = am.newValue;
    const no = s.versions.length ? s.versions[s.versions.length - 1].no + 1 : 1;
    s.versions.push({
      no,
      at: am.reviewedAt,
      data: newData,
      note:
        am.kind === "species"
          ? `物种修订：${am.oldValue} → ${am.newValue}`
          : `柜位迁移：${am.oldValue} → ${am.newValue}`,
    });
    s.locked = newData;
    am.versionNo = no;
  }
  // 驳回时 locked 不变：旧版保留，原柜位继续占用
  return next;
}

/* ---------------- 地点卡：建档后按锁定值聚合，未建档按纸签聚合 ---------------- */

export interface LocationCard {
  key: string;
  location: string;
  altitudes: string[];
  specimens: {
    id: string;
    collectionNo: string;
    species: string;
    collector: string;
    accessionNo?: string;
    archived: boolean;
  }[];
}

export function effectiveFields(s: Specimen): FieldData {
  if (s.status === "archived" && s.locked) return s.locked;
  return s.label;
}

export function locationCards(state: DomainState): LocationCard[] {
  const map = new Map<string, LocationCard>();
  state.specimens.forEach((s) => {
    const data = effectiveFields(s);
    const key = normalizeText(data.location);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, location: data.location, altitudes: [], specimens: [] });
    }
    const card = map.get(key)!;
    if (!card.altitudes.some((a) => fieldEquals("altitude", a, data.altitude))) {
      card.altitudes.push(data.altitude);
    }
    card.specimens.push({
      id: s.id,
      collectionNo: s.collectionNo,
      species: data.species,
      collector: data.collector,
      accessionNo: s.accessionNo,
      archived: s.status === "archived",
    });
  });
  return [...map.values()].sort((a, b) => a.location.localeCompare(b.location, "zh-CN"));
}

export const STATUS_LABELS: Record<Specimen["status"], string> = {
  waiting: "待领取",
  draft: "转录中",
  review: "待复核",
  returned: "复核退回",
  archived: "已建档",
};

export function isResult<T>(v: T | ActionResult): v is ActionResult {
  return typeof v === "object" && v !== null && "ok" in v;
}
