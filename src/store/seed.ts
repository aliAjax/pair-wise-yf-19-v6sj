import type { DomainState, FieldData, Specimen } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const T = Date.parse("2026-09-24T09:00:00+08:00");

let seq = 0;
const rid = (prefix: string) => `${prefix}-${(++seq).toString(36)}${T.toString(36).slice(-3)}`;

export function buildCabinets(): string[] {
  const list: string[] = [];
  ["A", "B", "C"].forEach((zone) => {
    for (let rack = 1; rack <= 4; rack++) {
      for (let cell = 1; cell <= 6; cell++) {
        list.push(`${zone}-${String(rack).padStart(2, "0")}-${String(cell).padStart(2, "0")}`);
      }
    }
  });
  return list;
}

const f = (species: string, location: string, altitude: string, collector: string, cabinet: string): FieldData => ({
  species,
  location,
  altitude,
  collector,
  cabinet,
});

interface SeedSpec {
  no: string;
  label: FieldData;
}

const LABELS: SeedSpec[] = [
  { no: "HX-20260918-01", label: f("色木槭 Acer mono", "浙江·天目山·三里亭", "海拔 640 m", "周慧、林放", "A-01-01") },
  { no: "HX-20260918-02", label: f("蕨叶天门冬 Asparagus filicinus", "浙江·天目山·倒挂莲峰", "海拔 980 m", "周慧", "A-01-02") },
  { no: "HX-20260919-01", label: f("黄山木兰 Yulania cylindrica", "安徽·黄山·始信峰", "海拔 1610 m", "高远、宋岚", "B-02-03") },
  { no: "HX-20260919-02", label: f("香附子 Cyperus rotundus", "安徽·黄山·汤口溪边", "海拔 430 m", "宋岚", "B-02-04") },
  { no: "HX-20260920-01", label: f("千里光 Senecio scandens", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05") },
  { no: "HX-20260920-02", label: f("金线草 Persicaria filiformis", "江西·庐山·锦绣谷", "海拔 860 m", "郑海", "C-03-06") },
  { no: "HX-20260921-01", label: f("紫花前胡 Angelica decursiva", "浙江·清凉峰·龙塘山", "海拔 1020 m", "周慧、高远", "A-02-03") },
  { no: "HX-20260922-01", label: f("大吴风草 Farfugium japonicum", "浙江·天目山·禅源寺", "海拔 350 m", "林放", "A-02-04") },
];

export function buildSeed(): DomainState {
  seq = 0;
  const cabinets = buildCabinets();
  const [s1, s2, s3, s4, s5, s6, s7, s8] = LABELS;

  const make = (partial: Partial<Specimen> & { no: string; label: FieldData }): Specimen => {
    const { no, label, ...rest } = partial;
    return {
      id: rid("sp"),
      collectionNo: no,
      label,
      status: "waiting",
      reviews: [],
      versions: [],
      amendments: [],
      ...rest,
    };
  };

  const specimens: Specimen[] = [
    // 1. 待领取
    make({ no: s1.no, label: s1.label }),

    // 2. 转录中（已领取，草稿未提交）
    make({
      no: s2.no,
      label: s2.label,
      status: "draft",
      claimedBy: "林放",
      claimedAt: T - 2 * DAY,
      draft: f("蕨叶天门冬 Asparagus filicinus", "浙江·天目山·倒挂莲峰", "", "周慧", "A-01-02"),
    }),

    // 3. 复核退回：旧稿保留，逐字段留痕
    make({
      no: s3.no,
      label: s3.label,
      status: "returned",
      claimedBy: "高远",
      claimedAt: T - 6 * DAY,
      draft: f("黄山木兰", "安徽·黄山·始信峰", "海拔 1610 m", "高远、宋岚", "B-02-03"),
      submittedAt: T - 5 * DAY,
      reviews: [
        {
          id: rid("rv"),
          reviewer: "周慧",
          at: T - 5 * DAY + 3 * 3600 * 1000,
          result: "returned",
          note: "物种名缺拉丁名；采集人“高远”与标签不符，退回保留旧稿。",
          snapshot: f("黄山木兰", "安徽·黄山·始信峰", "海拔 1610 m", "高远、宋岚", "B-02-03"),
          verdicts: [
            { field: "species", match: false, note: "缺拉丁名" },
            { field: "location", match: true },
            { field: "altitude", match: true },
            { field: "collector", match: false, note: "应为“高远”" },
            { field: "cabinet", match: true },
          ],
        },
      ],
    }),

    // 4. 待复核：柜位此刻不预占，通过瞬间才登记
    make({
      no: s4.no,
      label: s4.label,
      status: "review",
      claimedBy: "宋岚",
      claimedAt: T - 1 * DAY,
      submittedAt: T - 2 * 3600 * 1000,
      draft: f("香附子 Cyperus rotundus", "安徽·黄山·汤口溪边", "海拔 430 m", "宋岚", "B-02-04"),
    }),

    // 5. 已建档，且有一条物种修订通过记录（旧版本留档）
    make({
      no: s5.no,
      label: s5.label,
      status: "archived",
      claimedBy: "郑海",
      claimedAt: T - 10 * DAY,
      submittedAt: T - 10 * DAY + 3600 * 1000,
      accessionNo: "HN-0001",
      locked: f("千里光 Senecio scandens", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05"),
      draft: f("千里光 Senecio scandens", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05"),
      versions: [
        {
          no: 1,
          at: T - 10 * DAY + 4 * 3600 * 1000,
          note: "建档锁定",
          data: f("千里光 Senecio sp.", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05"),
        },
        {
          no: 2,
          at: T - 2 * DAY,
          note: "物种修订：补全拉丁学名",
          data: f("千里光 Senecio scandens", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05"),
        },
      ],
      reviews: [
        {
          id: rid("rv"),
          reviewer: "周慧",
          at: T - 10 * DAY + 4 * 3600 * 1000,
          result: "approved",
          snapshot: f("千里光 Senecio sp.", "江西·庐山·花径", "海拔 1100 m", "郑海、林放", "C-03-05"),
          verdicts: [
            { field: "species", match: true },
            { field: "location", match: true },
            { field: "altitude", match: true },
            { field: "collector", match: true },
            { field: "cabinet", match: true },
          ],
        },
      ],
      amendments: [
        {
          id: rid("am"),
          kind: "species",
          oldValue: "千里光 Senecio sp.",
          newValue: "千里光 Senecio scandens",
          reason: "复核拉丁名，经专家确认补全种加词。",
          proposer: "郑海",
          createdAt: T - 3 * DAY,
          status: "approved",
          reviewer: "高远",
          reviewedAt: T - 2 * DAY,
          reviewNote: "与鉴定文献一致。",
          versionNo: 2,
        },
      ],
    }),

    // 6. 已建档，柜位变更待复核：原柜位不释放、新柜位不预占
    make({
      no: s6.no,
      label: s6.label,
      status: "archived",
      claimedBy: "郑海",
      claimedAt: T - 8 * DAY,
      submittedAt: T - 8 * DAY + 2 * 3600 * 1000,
      accessionNo: "HN-0002",
      locked: f("金线草 Persicaria filiformis", "江西·庐山·锦绣谷", "海拔 860 m", "郑海", "C-03-06"),
      draft: f("金线草 Persicaria filiformis", "江西·庐山·锦绣谷", "海拔 860 m", "郑海", "C-03-06"),
      versions: [
        {
          no: 1,
          at: T - 8 * DAY + 3 * 3600 * 1000,
          note: "建档锁定",
          data: f("金线草 Persicaria filiformis", "江西·庐山·锦绣谷", "海拔 860 m", "郑海", "C-03-06"),
        },
      ],
      amendments: [
        {
          id: rid("am"),
          kind: "cabinet",
          oldValue: "C-03-06",
          newValue: "B-04-02",
          reason: "C 区柜体检修，整批平移至 B 区，标签随标本更新。",
          proposer: "林放",
          createdAt: T - 5 * 3600 * 1000,
          status: "review",
        },
      ],
    }),

    // 7. 已建档，无变更
    make({
      no: s7.no,
      label: s7.label,
      status: "archived",
      claimedBy: "周慧",
      claimedAt: T - 6 * DAY,
      submittedAt: T - 6 * DAY + 3600 * 1000,
      accessionNo: "HN-0003",
      locked: f("紫花前胡 Angelica decursiva", "浙江·清凉峰·龙塘山", "海拔 1020 m", "周慧、高远", "A-02-03"),
      draft: f("紫花前胡 Angelica decursiva", "浙江·清凉峰·龙塘山", "海拔 1020 m", "周慧、高远", "A-02-03"),
      versions: [
        {
          no: 1,
          at: T - 6 * DAY + 2 * 3600 * 1000,
          note: "建档锁定",
          data: f("紫花前胡 Angelica decursiva", "浙江·清凉峰·龙塘山", "海拔 1020 m", "周慧、高远", "A-02-03"),
        },
      ],
    }),

    // 8. 待领取
    make({ no: s8.no, label: s8.label }),
  ];

  return { version: 1, specimens, cabinets, counter: 3 };
}

const STORAGE_KEY = "herbarium.archive.v1";

export function loadState(): DomainState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DomainState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.specimens)) return parsed;
    }
  } catch {
    // 落盘数据损坏时回退到种子数据
  }
  const seed = buildSeed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {
    // 无痕模式下仅内存可用
  }
  return seed;
}

export function saveState(state: DomainState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败
  }
}

export function resetState(): DomainState {
  const seed = buildSeed();
  saveState(seed);
  return seed;
}
