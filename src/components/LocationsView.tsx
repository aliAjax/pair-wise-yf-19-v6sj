import { useStore } from "../store/store";
import { locationCards } from "../store/logic";

export function LocationsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useStore();
  const cards = locationCards(state);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>采集地点信息卡</p>
          <h2>与队列、详情共用同一份本地数据</h2>
        </div>
        <span className="hint">已建档按锁定值聚合，未建档按纸签聚合 · 共 {cards.length} 个采集点</span>
      </div>
      <div className="location-grid">
        {cards.map((card) => (
          <article key={card.key} className="location-card">
            <h3>{card.location}</h3>
            <p className="loc-altitude">{card.altitudes.join(" / ")}</p>
            <ul>
              {card.specimens.map((sp) => (
                <li key={sp.id} onClick={() => onOpen(sp.id)}>
                  <span>
                    {sp.species}
                    <small>
                      {sp.collectionNo} · {sp.collector}
                    </small>
                  </span>
                  <em className={sp.archived ? "archived" : "pending"}>
                    {sp.accessionNo ?? "未建档"}
                  </em>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {cards.length === 0 && <p className="empty">暂无地点信息。</p>}
      </div>
    </section>
  );
}
