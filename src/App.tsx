import { useMemo, useState } from "react";
import "./styles.css";
import { StoreProvider, useStore } from "./store/store";
import { QueueView } from "./components/QueueView";
import { DetailView } from "./components/DetailView";
import { LocationsView } from "./components/LocationsView";
import { CabinetView } from "./components/CabinetView";

type Tab = "queue" | "locations" | "cabinets";

/** 页面状态：只在内存中维护，与校录判定等领域数据分开，不写入本地存档 */
interface ViewState {
  tab: Tab;
  detailId: string | null;
}

function Metrics() {
  const { state } = useStore();
  const metrics = useMemo(() => {
    const waiting = state.specimens.filter((s) => s.status === "waiting").length;
    const review = state.specimens.filter(
      (s) => s.status === "review" || s.amendments.some((a) => a.status === "review"),
    ).length;
    const archived = state.specimens.filter((s) => s.status === "archived").length;
    const locations = new Set(
      state.specimens
        .map((s) => (s.status === "archived" && s.locked ? s.locked.location : s.label.location))
        .filter(Boolean),
    ).size;
    return [
      { label: "待领取", value: waiting },
      { label: "待复核（含变更）", value: review },
      { label: "已建档", value: archived },
      { label: "采集点", value: locations },
    ];
  }, [state]);

  return (
    <section className="metrics">
      {metrics.map((m) => (
        <article key={m.label}>
          <small>{m.label}</small>
          <strong>{m.value}</strong>
        </article>
      ))}
    </section>
  );
}

function Shell() {
  const { staff, setStaff, resetAll, state } = useStore();
  // 页面状态独立维护：切 tab、打开详情都不触碰存档
  const [view, setView] = useState<ViewState>({ tab: "queue", detailId: null });

  const detail = view.detailId ? state.specimens.find((s) => s.id === view.detailId) : undefined;

  const open = (id: string) => setView({ tab: "queue", detailId: id });
  const back = () => setView((v) => ({ ...v, detailId: null }));

  const tabs: Array<{ key: Tab; text: string }> = [
    { key: "queue", text: "转录队列" },
    { key: "locations", text: "采集地点信息卡" },
    { key: "cabinets", text: "馆藏柜位记录" },
  ];

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="leaf">❦</span>
          <div>
            <h1>植物标本馆数字建档</h1>
            <p>纸签抄录 · 录入与复核分离 · 本地数据重开可续</p>
          </div>
        </div>
        <div className="staff-box">
          <label>
            <span>当前工作人员</span>
            <input
              value={staff}
              placeholder="姓名（领取/复核身份）"
              onChange={(e) => setStaff(e.target.value)}
            />
          </label>
          <button
            className="ghost"
            onClick={() => {
              if (confirm("恢复演示数据？当前本地存档将被覆盖。")) resetAll();
            }}
          >
            重置演示数据
          </button>
        </div>
      </header>

      <Metrics />

      {view.tab === "queue" && detail ? (
        <DetailView specimen={detail} onBack={back} />
      ) : (
        <>
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={view.tab === t.key ? "tab active" : "tab"}
                onClick={() => setView({ tab: t.key, detailId: null })}
              >
                {t.text}
              </button>
            ))}
          </nav>
          {view.tab === "queue" && <QueueView onOpen={open} />}
          {view.tab === "locations" && <LocationsView onOpen={open} />}
          {view.tab === "cabinets" && <CabinetView onOpen={open} />}
        </>
      )}
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
