import { useMemo, useState } from "react";
import type { Specimen, SpecimenStatus } from "../types";
import { STATUS_LABELS, pendingCabinetAmendment } from "../store/logic";
import { useStore } from "../store/store";

const FILTERS: Array<{ key: SpecimenStatus | "all" | "amending"; text: string }> = [
  { key: "all", text: "全部" },
  { key: "waiting", text: "待领取" },
  { key: "draft", text: "转录中" },
  { key: "review", text: "待复核" },
  { key: "returned", text: "复核退回" },
  { key: "amending", text: "变更待复核" },
  { key: "archived", text: "已建档" },
];

function matchFilter(s: Specimen, key: (typeof FILTERS)[number]["key"]): boolean {
  if (key === "all") return true;
  if (key === "amending") return s.amendments.some((a) => a.status === "review");
  if (key === "archived") return s.status === "archived" && !s.amendments.some((a) => a.status === "review");
  return s.status === key;
}

export function QueueView({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useStore();
  // 筛选条件属于页面状态，单独维护、不写本地数据
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [keyword, setKeyword] = useState("");

  const list = useMemo(() => {
    const kw = keyword.trim();
    return state.specimens
      .filter((s) => matchFilter(s, filter))
      .filter((s) => {
        if (!kw) return true;
        const hay = `${s.collectionNo} ${s.accessionNo ?? ""} ${s.claimedBy ?? ""} ${s.label.species} ${s.label.location}`;
        return hay.toLowerCase().includes(kw.toLowerCase());
      })
      .sort((a, b) => b.collectionNo.localeCompare(a.collectionNo));
  }, [state.specimens, filter, keyword]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    FILTERS.forEach(({ key }) => {
      c[key] = state.specimens.filter((s) => matchFilter(s, key)).length;
    });
    return c;
  }, [state.specimens]);

  return (
    <section className="panel queue-view">
      <div className="heading">
        <div>
          <p>转录队列</p>
          <h2>按采集号领取待转录标本</h2>
        </div>
        <input
          className="search"
          placeholder="搜采集号 / 馆藏号 / 物种"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="chips filter-chips">
        {FILTERS.map(({ key, text }) => (
          <button
            key={key}
            className={filter === key ? "chip active" : "chip"}
            onClick={() => setFilter(key)}
          >
            {text}
            <em>{counts[key]}</em>
          </button>
        ))}
      </div>

      <div className="queue-list">
        {list.map((s) => {
          const moving = pendingCabinetAmendment(s);
          return (
            <article key={s.id} className="queue-row" onClick={() => onOpen(s.id)}>
              <div className="queue-main">
                <h3>
                  {s.collectionNo}
                  {s.accessionNo && <span className="accession">{s.accessionNo}</span>}
                </h3>
                <p>
                  {s.status === "archived" && s.locked ? s.locked.species : s.label.species}
                  <i> · </i>
                  {s.status === "archived" && s.locked ? s.locked.location : s.label.location}
                </p>
                <p className="queue-meta">
                  {s.claimedBy ? `领取人 ${s.claimedBy}` : "无人领取"}
                  {s.status === "review" && s.submittedAt && " · 已提交，待复核"}
                  {s.status === "returned" && ` · 退回 ${s.reviews.length} 次（旧稿保留）`}
                  {moving && ` · 柜位变更待复核：${moving.oldValue} → ${moving.newValue}（原柜位暂不释放）`}
                </p>
              </div>
              <span className={`status-badge status-${s.status}`}>{STATUS_LABELS[s.status]}</span>
            </article>
          );
        })}
        {list.length === 0 && <p className="empty">没有符合条件的标本。</p>}
      </div>
    </section>
  );
}
