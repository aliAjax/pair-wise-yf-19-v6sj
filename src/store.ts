import type {
  Amendment,
  LabelField,
  LabelInfo,
  ReviewRecord,
  Specimen,
  StoreData,
} from "./types";

const STORAGE_KEY = "herbarium-transcription-v1";

export const LABEL_FIELDS: {
  key: LabelField;
  label: string;
  hint: string;
}[] = [
  { key: "species", label: "物种", hint: "标签照片上的物种名称" },
  { key: "location", label: "地点", hint: "采集地点 / 小地名" },
  { key: "altitude", label: "海拔", hint: "如 1420 m" },
  { key: "collector", label: "采集人", hint: "含采集队多人姓名" },
];

export const EMPTY_LABEL: LabelInfo = {
  species: "",
  location: "",
  altitude: "",
  collector: "",
  cabinet: "",
};

export function normalize(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

/** 校录判定：单个字段是否与标签照片一致（与页面状态分开维护） */
export function compareField(actual: string, entered: string): boolean {
  return normalize(actual) !== "" && normalize(actual) === normalize(entered);
}

/** 规范化柜位号，如 b 12 04 -> B-12-04 */
export function normalizeCabinet(value: string): string {
  const compact = value.replace(/[\s\-—–_/\\]+/g, "").toUpperCase();
  const m = compact.match(/^([A-Z]+)(\d+)(\d{2})$/);
  if (!m) return compact;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function nowText(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// ---------- 柜位占用：以已馆藏标本实时推导，不做预占 ----------

/** 当前真正占用柜位的馆藏标本（待复核 / 退回中的柜位不算占用） */
export function occupiedCabinetMap(
  specimens: Specimen[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of specimens) {
    if (s.status === "archived" && s.locked?.cabinet) {
      map.set(s.locked.cabinet, s.id);
    }
  }
  return map;
}

export function isCabinetFree(
  specimens: Specimen[],
  cabinet: string,
  exceptSpecimenId?: string
): boolean {
  const target = normalizeCabinet(cabinet);
  if (!target) return false;
  const occupied = occupiedCabinetMap(specimens);
  const holder = occupied.get(target);
  return holder === undefined || holder === exceptSpecimenId;
}

// ---------- 馆藏号 ----------

export function issueAccessionNo(data: StoreData): string {
  const year = new Date().getFullYear();
  const next = (data.accessionCounters[year] ?? 0) + 1;
  data.accessionCounters[year] = next;
  return `HBG-${year}-${String(next).padStart(4, "0")}`;
}

// ---------- 持久化（队列、地点卡、柜位记录、详情共用同一份本地数据） ----------

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreData;
      if (Array.isArray(parsed.specimens)) return parsed;
    }
  } catch {
    // 本地数据损坏时回落到种子数据
  }
  return seedData();
}

export function saveStore(data: StoreData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetStore(): StoreData {
  const data = seedData();
  saveStore(data);
  return data;
}

let reviewSeq = 0;
let amendmentSeq = 0;
export function nextReviewId(): string {
  reviewSeq += 1;
  return `RV-${Date.now().toString(36)}-${reviewSeq}`;
}
export function nextAmendmentId(): string {
  amendmentSeq += 1;
  return `AM-${Date.now().toString(36)}-${amendmentSeq}`;
}

export function makeReview(
  r: Omit<ReviewRecord, "id" | "at">
): ReviewRecord {
  return { id: nextReviewId(), at: nowText(), ...r };
}

export function makeAmendment(
  a: Omit<Amendment, "id" | "requestedAt" | "status">
): Amendment {
  return {
    id: nextAmendmentId(),
    requestedAt: nowText(),
    status: "pending_review",
    ...a,
  };
}

// ---------- 种子数据：覆盖流水线各状态，便于重开继续演示 ----------

type SpecimenSeed = Omit<Specimen, "reviews" | "amendments"> &
  Partial<Pick<Specimen, "reviews" | "amendments">>;

function seedData(): StoreData {
  const raw: SpecimenSeed[] = [
    {
      id: "sp-01",
      collectionNo: "HX-240615-01",
      label: {
        species: "青榨槭 Acer davidii",
        location: "湖北神农架木鱼镇阴峪河",
        altitude: "1420 m",
        collector: "刘长青、周敏",
        cabinet: "D-01-01",
      },
      draft: { ...EMPTY_LABEL },
      status: "pending",
    },
    {
      id: "sp-02",
      collectionNo: "HX-240615-08",
      label: {
        species: "荚果蕨 Matteuccia struthiopteris",
        location: "湖北神农架红坪镇巴东垭",
        altitude: "1860 m",
        collector: "周敏",
        cabinet: "D-02-03",
      },
      draft: {
        species: "荚果蕨 Matteuccia struthiopteris",
        location: "湖北神农架红坪镇巴东垭",
        altitude: "1860m",
        collector: "周敏",
        cabinet: "D-02-03",
      },
      status: "transcribing",
      assignee: "标本员·小何",
      assignedAt: "2026-09-24 08:40",
    },
    {
      id: "sp-03",
      collectionNo: "HX-240616-03",
      label: {
        species: "毛华菊 Chrysanthemum vestitum",
        location: "湖北宜昌大老岭林场",
        altitude: "1150 m",
        collector: "刘长青",
        cabinet: "A-07-02",
      },
      draft: {
        species: "毛华菊 Chrysanthemum vestitum",
        location: "湖北宜昌大老岭林场",
        altitude: "1150 m",
        collector: "刘长青、周敏",
        cabinet: "A-07-02",
      },
      status: "review",
      assignee: "标本员·小何",
      assignedAt: "2026-09-23 15:12",
      submittedAt: "2026-09-24 09:05",
      reviews: [
        makeReview({
          kind: "initial",
          reviewer: "复核员·老韩",
          result: "reject",
          verdicts: {
            species: "match",
            location: "match",
            altitude: "match",
            collector: "mismatch",
          },
          cabinetOk: true,
          note: "采集人与标签照片不符：标签为“刘长青”，录入多写了“周敏”。退回保留上一版。",
        }),
      ],
      lastRejectNote:
        "采集人与标签照片不符：标签为“刘长青”，录入多写了“周敏”。退回保留上一版。",
    },
    {
      id: "sp-04",
      collectionNo: "HX-240612-17",
      label: {
        species: "猫儿屎 Decaisnea insignis",
        location: "湖北神农架九湖乡落羊河",
        altitude: "980 m",
        collector: "田野",
        cabinet: "B-05-09",
      },
      draft: {
        species: "猫儿屎 Decaisnea insignis",
        location: "湖北神农架九湖乡落羊河",
        altitude: "980 m",
        collector: "田野",
        cabinet: "B-05-09",
      },
      status: "review",
      assignee: "标本员·小何",
      assignedAt: "2026-09-24 07:50",
      submittedAt: "2026-09-24 09:20",
    },
    {
      id: "sp-05",
      collectionNo: "HX-240610-22",
      label: {
        species: "串果藤 Sinofranchetia chinensis",
        location: "湖北恩施星斗山",
        altitude: "1260 m",
        collector: "刘长青",
        cabinet: "B-12-04",
      },
      draft: {
        species: "串果藤 Sinofranchetia chinensis",
        location: "湖北恩施星斗山",
        altitude: "1260 m",
        collector: "刘长青",
        cabinet: "B-12-04",
      },
      status: "archived",
      assignee: "标本员·小何",
      assignedAt: "2026-09-20 10:00",
      submittedAt: "2026-09-20 11:00",
      accessionNo: "HBG-2026-0001",
      archivedAt: "2026-09-20 11:30",
      locked: {
        species: "串果藤 Sinofranchetia chinensis",
        location: "湖北恩施星斗山",
        altitude: "1260 m",
        collector: "刘长青",
        cabinet: "B-12-04",
      },
      reviews: [
        makeReview({
          kind: "initial",
          reviewer: "复核员·老韩",
          result: "approve",
          verdicts: {
            species: "match",
            location: "match",
            altitude: "match",
            collector: "match",
          },
          cabinetOk: true,
          note: "四项与标签照片一致，柜位可用，发号上柜。",
        }),
      ],
      amendments: [],
    },
  ];

  // sp-03 种子里经历过一次退回：标本员已更正采集人并重新提交，当前待复核
  raw[2].draft.collector = "刘长青";

  const specimens: Specimen[] = raw.map((s) => ({
    reviews: [],
    amendments: [],
    ...s,
  }));

  return {
    specimens,
    accessionCounters: { 2026: 1 },
    cabinetCells: [
      "A-07-02",
      "B-05-09",
      "B-12-04",
      "C-03-11",
      "D-01-01",
      "D-02-03",
    ],
    reviewSeq: 2,
    amendmentSeq: 0,
    heldCabinets: [],
  };
}
