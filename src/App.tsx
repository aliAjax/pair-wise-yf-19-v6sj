import { useMemo, useState } from "react";
import "./styles.css";
import { useStore } from "./useStore";
import { occupiedCabinetMap } from "./store";
import { Queue } from "./components/Queue";
import { LocationCards } from "./components/LocationCards";
import { CabinetBoard } from "./components/CabinetBoard";
import { SpecimenDetail } from "./components/SpecimenDetail";

type Tab = "queue" | "locations" | "cabinets";

const TABS: { key: Tab; text: string }[] = [
  { key: "queue", text: "入库队列" },
  { key: "locations", text: "采集地点卡" },
  { key: "cabinets", text: "柜位记录" },
];

function App() {
  const store = useStore();
  const { data } = store;
  const [tab, setTab] = useState<Tab>("queue");
  const [detailId, setDetailId] = useState<string | null>(null);

  const occupied = useMemo(
    () => occupiedCabinetMap(data.specimens),
    [data.specimens]
  );

  const cabinetBusy = (cell: string, selfId?: string) => {
    const holder = occupied.get(cell);
    return holder !== undefined && holder !== selfId;
  };

  const metrics = useMemo(() => {
    const c = {
      pending: 0,
      transcribing: 0,
      review: 0,
      archived: 0,
      rejected: 0,
    };
    const locations = new Set<string>();
    for (const s of data.specimens) {
      c[s.status] += 1;
      locations.add(s.label.location);
    }
    return [
      { label: "待转录", value: c.pending },
      { label: "在办（转录/待复核/退回）", value: c.transcribing + c.review + c.rejected },
      { label: "已上柜锁定", value: c.archived },
      { label: "采集点", value: locations.size },
    ];
  }, [data.specimens]);

  const detail = detailId
    ? data.specimens.find((s) => s.id === detailId)
    : undefined;

  const openDetail = (id: string) => {
    setDetailId(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62007 · 植物标本馆数字建档 · 纸签抄录工作流</p>
        <h1>压制标本转录入库台</h1>
        <span>
          标本员按采集号领取待转录标本，抄录物种、地点、海拔、采集人与柜位；
          录入与复核分开，任一字段与标签照片不符即退回并保留旧版，柜位不预占。
          全部一致后发放馆藏号、锁定原字段；此后改物种或柜位须写明原因重新复核，原柜位暂不释放。
          数据保存在浏览器本地，重开可继续。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {detail ? (
        <SpecimenDetail
          specimen={detail}
          allSpecimens={data.specimens}
          heldCells={data.heldCabinets.map((h) => h.cell)}
          onBack={() => setDetailId(null)}
          onRequest={store.requestAmendment}
          onReviewAmendment={store.reviewAmendment}
        />
      ) : (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={tab === t.key ? "tab on" : "tab"}
                onClick={() => setTab(t.key)}
              >
                {t.text}
              </button>
            ))}
            <button
              className="reset"
              onClick={() => {
                if (window.confirm("清空本地数据并恢复演示数据？"))
                  store.resetAll();
              }}
            >
              重置本地数据
            </button>
          </nav>

          {tab === "queue" && (
            <Queue
              specimens={data.specimens}
              cabinetBusy={cabinetBusy}
              onClaim={store.claim}
              onSaveDraft={store.saveDraft}
              onSubmit={store.submitForReview}
              onReview={store.reviewInitial}
              onOpen={openDetail}
            />
          )}
          {tab === "locations" && (
            <LocationCards specimens={data.specimens} onOpen={openDetail} />
          )}
          {tab === "cabinets" && (
            <CabinetBoard
              data={data}
              onOpen={openDetail}
              onRelease={store.releaseHeldCabinet}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;
