import { useMemo } from "react";
import { useStore } from "../store/store";
import { cabinetRegistry, pendingCabinetAmendment } from "../store/logic";

export function CabinetView({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useStore();
  const registry = useMemo(() => cabinetRegistry(state), [state]);
  const zones = useMemo(() => {
    const map = new Map<string, string[]>();
    state.cabinets.forEach((code) => {
      const zone = code.split("-")[0];
      if (!map.has(zone)) map.set(zone, []);
      map.get(zone)!.push(code);
    });
    return [...map.entries()];
  }, [state.cabinets]);

  const moving = state.specimens.filter((s) => pendingCabinetAmendment(s));

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>馆藏柜位记录</p>
          <h2>占用只在复核通过瞬间登记，绝不先占</h2>
        </div>
        <div className="legend">
          <span><i className="dot occupied" />已占用</span>
          <span><i className="dot moving" />迁出审核中（原柜不释放）</span>
          <span><i className="dot incoming" />拟调入（不预占）</span>
          <span><i className="dot free" />空闲</span>
        </div>
      </div>

      {moving.length > 0 && (
        <div className="moving-banner">
          {moving.map((s) => {
            const a = pendingCabinetAmendment(s)!;
            return (
              <p key={s.id}>
                <strong>{s.accessionNo} · {s.collectionNo}</strong> 柜位变更待复核：
                <b> {a.oldValue}</b> → <b>{a.newValue}</b>
                <button className="link" onClick={() => onOpen(s.id)}>去复核</button>
                <span className="hint">（原柜位暂不释放，新柜位暂不预占）</span>
              </p>
            );
          })}
        </div>
      )}

      <div className="cabinet-zones">
        {zones.map(([zone, codes]) => (
          <div key={zone} className="cabinet-zone">
            <h3>{zone} 区</h3>
            <div className="cabinet-grid">
              {codes.map((code) => {
                const info = registry.get(code)!;
                const cls = info.movingOut ? "moving" : info.status;
                return (
                  <button
                    key={code}
                    className={`cabinet-cell ${cls}`}
                    disabled={info.status !== "occupied"}
                    onClick={() => info.specimenId && onOpen(info.specimenId)}
                    title={info.collectionNo ? `${info.accessionNo} ${info.collectionNo}` : "空闲"}
                  >
                    <b>{code}</b>
                    {info.status === "occupied" && (
                      <small>
                        {info.accessionNo}
                        {info.movingOut && " · 迁出中"}
                      </small>
                    )}
                    {info.status === "incoming" && <small>拟自 {info.incomingFrom}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
