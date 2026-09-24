// 领域模型：校录判定、版本、变更申请都属于持久化的业务数据
// （页面导航、筛选、表单输入等界面状态不在此文件中）

export type FieldKey = "species" | "location" | "altitude" | "collector" | "cabinet";

export const FIELD_KEYS: FieldKey[] = ["species", "location", "altitude", "collector", "cabinet"];

export const FIELD_LABELS: Record<FieldKey, string> = {
  species: "物种",
  location: "地点",
  altitude: "海拔",
  collector: "采集人",
  cabinet: "柜位",
};

/** 一份纸签上的五个字段，也是转录稿、锁定版本的统一结构 */
export interface FieldData {
  species: string;
  location: string;
  altitude: string;
  collector: string;
  cabinet: string;
}

export type SpecimenStatus =
  | "waiting" // 待领取
  | "draft" // 转录中
  | "review" // 待复核
  | "returned" // 复核退回（保留旧稿）
  | "archived"; // 已建档（锁定）

export interface Verdict {
  field: FieldKey;
  match: boolean;
  note?: string;
}

export interface ReviewRecord {
  id: string;
  reviewer: string;
  at: number;
  result: "approved" | "returned";
  verdicts: Verdict[];
  note?: string;
  /** 被判定时的转录稿快照 */
  snapshot: FieldData;
}

export interface Amendment {
  id: string;
  kind: "species" | "cabinet";
  oldValue: string;
  newValue: string;
  reason: string;
  proposer: string;
  createdAt: number;
  status: "review" | "approved" | "rejected";
  reviewer?: string;
  reviewedAt?: number;
  reviewNote?: string;
  /** 通过后对应的锁定版本号 */
  versionNo?: number;
}

export interface VersionSnapshot {
  no: number;
  at: number;
  data: FieldData;
  note: string;
}

export interface Specimen {
  id: string;
  /** 采集号（领取与转录的凭据） */
  collectionNo: string;
  /** 纸签照片上的内容，是复核判定的唯一依据 */
  label: FieldData;
  status: SpecimenStatus;
  claimedBy?: string;
  claimedAt?: number;
  /** 当前转录稿；退回时保留，不被清空 */
  draft?: FieldData;
  submittedAt?: number;
  reviews: ReviewRecord[];
  accessionNo?: string;
  /** 复核通过后的锁定字段 */
  locked?: FieldData;
  versions: VersionSnapshot[];
  amendments: Amendment[];
}

export interface DomainState {
  version: 1;
  specimens: Specimen[];
  /** 柜位登记表 */
  cabinets: string[];
  /** 馆藏号自增计数 */
  counter: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export const emptyDraft = (): FieldData => ({
  species: "",
  location: "",
  altitude: "",
  collector: "",
  cabinet: "",
});
