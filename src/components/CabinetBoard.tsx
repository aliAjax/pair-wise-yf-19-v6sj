import { useMemo } from "react";
import type { Specimen, StoreData } from "../types";
import { normalizeCabinet, occupiedCabinetMap } from "../store";
import { Panel } from "./common";

export function CabinetBoard({
  data,
  onOpen,
  onRelease,
}: {
  data: StoreData;
  onOpen: (id: string) => void;
  onRelease: (cell: string) => void;
}) {
  const occupied = useMemo(
    () => occupiedCabinetMap(data.specimens),
    [data.specimens]
  );
  const held = useMemo(
    () => new Map(data.heldCabinets.map((h) => [h.cell, h])),
    [data.heldCabinets]
  );

  // 把录入中 / 待复核里出现过的柜位也提示出来（只是意向，未占用）
  const intents = useMemo(() => {
    const map = new Map<string, Specimen>();
    for (const s of data.specimens) {
      if (s.status === "archived") continue;
      const cell = normalizeCabinet(s.draft.cabinet);
      if (cell) map.set(cell, s);
    }
    return map;
  }, [data.specimens]);

  const cells = useMemo(() => {
    const all = new Set<string>(data.cabinetCells);
    occupied.forEach((_, cell) => all.add(cell));
    held.forEach((_, cell) => all.add(cell));
    intents.forEach((_, cell) => all.add(cell));
    return [...all].sort();
  }, [data.cabinetCells, occupied, held, intents]);

  const archivedCount = data.specimens.filter(
    (s) => s.status === "archived"
  ).length;

  return (
    <Panel
      title="馆藏柜位记录"
      hint="柜位不能先占"
      extra={
        <span className="muted">
          已上柜 {archivedCount} · 暂留 {data.heldCabinets.length} · 空闲{" "}
          {
            cells.filter(
              (c) => !occupied.has(c) && !held.has(c)
            ).length
          }
        </span>
      }
    >
      <div className="legend">
        <span><i className="lg-free" /> 空闲</span>
        <span><i className="lg-used" /> 已上柜占用</span>
        <span><i className="lg-held" /> 调柜后暂留（未释放）</span>
        <span><i className="lg-intent" /> 仅录入意向（未预占）</span>
      </div>
      <div className="cabinet-grid">
        {cells.map((cell) => {
          const holderId = occupied.get(cell);
          const holder = holderId
            ? data.specimens.find((s) => s.id === holderId)
            : undefined;
          const heldInfo = held.get(cell);
          const intent = intents.get(cell);

          let cls = "cab-cell free";
          if (holder) cls = "cab-cell used";
          else if (heldInfo) cls = "cab-cell held";
          else if (intent) cls = "cab-cell intent";

          return (
            <div key={cell} className={cls}>
              <header>
                <b>{cell}</b>
                {holder && <span className="mini-badge">已上柜</span>}
                {heldInfo && <span className="mini-badge warn">暂留</span>}
                {intent && <span className="mini-badge ghost">意向</span>}
              </header>
              {holder ? (
                <button className="cell-link" onClick={() => onOpen(holder.id)}>
                  {holder.accessionNo}
                  <small>{holder.locked?.species}</small>
                </button>
              ) : heldInfo ? (
                <div className="cell-held">
                  <small>{heldInfo.reason}</small>
                  <small>自 {heldInfo.since}</small>
                  <button
                    className="tiny"
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认实物已从 ${cell} 搬走，可以释放该柜位？`
                        )
                      )
                        onRelease(cell);
                    }}
                  >
                    实物已搬走，释放柜位
                  </button>
                </div>
              ) : intent ? (
                <small className="muted">
                  {intent.collectionNo}
                  {intent.status === "review" ? " 待复核" : " 转录中"}
                  ，不预占
                </small>
              ) : (
                <small className="muted">空闲可分配</small>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
