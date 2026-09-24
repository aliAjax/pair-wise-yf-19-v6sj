// 业务域类型定义

/** 采集标签上的可转录字段 */
export type LabelField = "species" | "location" | "altitude" | "collector";

/** 复核时每个标签字段的独立判定（校录判定，与页面状态分开维护） */
export type FieldVerdict = "match" | "mismatch";

/** 标本在录入-复核流水线中的状态（页面状态） */
export type SpecimenStatus =
  | "pending" // 待转录：尚未被标本员领取
  | "transcribing" // 转录中：已领取，正在录入
  | "review" // 待复核：已提交，等待复核员比对标签照片
  | "archived" // 已馆藏：复核全部一致，已发馆藏号并锁定原字段
  | "rejected"; // 已退回：复核发现不符，退回转录，保留上一版（草稿）

/** 馆藏后发起的字段变更所处阶段 */
export type AmendmentStatus = "pending_review" | "approved" | "rejected";

/** 一次复核的记录：初核 或 变更复核共用 */
export interface ReviewRecord {
  id: string;
  kind: "initial" | "amendment";
  at: string;
  reviewer: string;
  result: "reject" | "approve";
  /** 初核：逐字段判定；变更复核：只判定本次涉及的字段 */
  verdicts?: Partial<Record<LabelField, FieldVerdict>>;
  /** 柜位是否可用（初核与柜位变更时使用） */
  cabinetOk?: boolean;
  note?: string;
  /** 变更复核关联的变更单 id */
  amendmentId?: string;
  /** 变更原因（变更复核时留痕） */
  reason?: string;
  /** 变更前的旧值，用于历史回放 */
  before?: Partial<LabelInfo>;
  /** 变更拟用值 */
  changed?: Partial<LabelInfo>;
}

/** 一次馆藏后变更（物种 / 柜位） */
export interface Amendment {
  id: string;
  specimenId: string;
  field: LabelField | "cabinet";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  oldValue: string;
  newValue: string;
  status: AmendmentStatus;
}

/** 标签信息：录入内容 + 柜位（柜位仅在发号后才真正占用） */
export interface LabelInfo {
  species: string;
  location: string;
  altitude: string;
  collector: string;
  cabinet: string;
}

export interface Specimen {
  id: string;
  /** 采集号：从纸签转录前的唯一标识 */
  collectionNo: string;
  /** 野外标签照片上的真值，复核员逐字段比对的依据 */
  label: LabelInfo;
  /** 领取后录入的草稿；提交后保留最近一版，退回时不覆盖已锁定内容 */
  draft: LabelInfo;
  status: SpecimenStatus;
  /** 领取人（录入与复核分开做：领取人负责录入） */
  assignee?: string;
  assignedAt?: string;
  submittedAt?: string;
  /** 馆藏号：全部一致后发放，形如 HBG-2024-0001，发放后不复用 */
  accessionNo?: string;
  archivedAt?: string;
  /** 发号后锁定的原字段值 */
  locked?: LabelInfo;
  reviews: ReviewRecord[];
  amendments: Amendment[];
  /** 复核退回原因，供转录员重新录入时参考 */
  lastRejectNote?: string;
}

export interface StoreData {
  specimens: Specimen[];
  /** 馆藏号年度计数（按发号年份） */
  accessionCounters: Record<number, number>;
  /** 已存在的柜位格子（系统柜位图），占用与否由馆藏标本实时推导 */
  cabinetCells: string[];
  reviewSeq: number;
  amendmentSeq: number;
  /** 柜位变更获批后暂不释放的原柜位（等待人工确认实物后再释放） */
  heldCabinets: {
    cell: string;
    specimenId: string;
    since: string;
    reason: string;
  }[];
}
