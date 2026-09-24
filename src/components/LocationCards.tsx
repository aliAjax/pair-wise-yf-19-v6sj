import { useMemo } from "react";
import type { Specimen } from "../types";
import { Panel } from "./common";

interface SiteGroup {
  region: string;
  sites: {
    name: string;
    altitude: string;
    specimen: Specimen;
  }[];
}

/** 从地点字段归纳地区卡（取省+山系/林场层级） */
function regionOf(location: string): string {
  const known = ["神农架", "宜昌", "恩施"];
  const hit = known.find((k) => location.includes(k));
  return hit ? `湖北 · ${hit}` : "其他采集点";
}

function shortSite(location: string): string {
  return location
    .replace(/^湖北/, "")
    .replace(/神农架|宜昌|恩施/, "")
    .trim() || location;
}

export function LocationCards({
  specimens,
  onOpen,
}: {
  specimens: Specimen[];
  onOpen: (id: string) => void;
}) {
  const groups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, SiteGroup>();
    for (const s of specimens) {
      const region = regionOf(s.label.location);
      const site = shortSite(s.label.location);
      if (!map.has(region)) map.set(region, { region, sites: [] });
      map.get(region)!.sites.push({
        name: site,
        altitude: s.label.altitude,
        specimen: s,
      });
    }
    return [...map.values()];
  }, [specimens]);

  return (
    <Panel
      title="采集地点信息卡"
      hint="按地点聚合"
      extra={<span className="muted">共 {groups.length} 个采集地区</span>}
    >
      <div className="site-grid">
        {groups.map((g) => (
          <article key={g.region} className="site-card">
            <header>
              <h3>{g.region}</h3>
              <span>{g.sites.length} 份标本</span>
            </header>
            <ul>
              {g.sites.map((site) => {
                const s = site.specimen;
                return (
                  <li key={s.id} onClick={() => onOpen(s.id)}>
                    <div>
                      <b>{site.name || "（地点未细分）"}</b>
                      <small>{site.altitude}</small>
                    </div>
                    <div className="site-side">
                      <small>{s.collectionNo}</small>
                      <small className="truncate">{s.label.species}</small>
                      <small className="muted">采集人：{s.label.collector}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </Panel>
  );
}
