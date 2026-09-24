import { useMemo, useState } from "react";
import type { FieldKey, Specimen, Verdict } from "../types";
import { FIELD_KEYS, FIELD_LABELS } from "../types";
import { compareFields, fieldEquals } from "../store/logic";
import { useStore } from "../store/store";
import { LabelPhoto } from "./LabelPhoto";

export function ReviewPanel({ specimen, onDone }: { specimen: Specimen; onDone: () => void }) {
  const { staff, submitReview, state } = useStore();
  const initial = useMemo<Verdict[]>(
    () => (specimen.draft ? compareFields(specimen.draft, specimen.label) : []),
    [specimen.id, specimen.status],
  );
  const [verdicts, setVerdicts] = useState<Verdict[]>(initial);
  const [reviewer, setReviewer] = useState(staff);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!specimen.draft) return <p className="empty">缺少转录稿，无法复核。</p>;

  const typed = specimen.draft;
  const allMatch = verdicts.length === 5 && verdicts.every((v) => v.match);
  const selfReview = reviewer.trim() === specimen.claimedBy;
  const cabinetBusy =
    allMatch &&
    (() => {
      const targetCabinet = specimen.label.cabinet.trim();
      const occ = state.specimens.find(
        (o) => o.id !== specimen.id && o.status === "archived" && o.locked?.cabinet === targetCabinet,
      );
      const registered = state.cabinets.includes(targetCabinet);
      return !registered
        ? `柜位 ${targetCabinet} 不在登记表中`
        : occ
          ? `纸签柜位 ${targetCabinet} 已被 ${occ.accessionNo} 占用`
          : null;
    })();

  const toggle = (key: FieldKey) =>
    setVerdicts((prev) => prev.map((v) => (v.field === key ? { ...v, match: !v.match } : v)));

  const submit = () => {
    const result = submitReview(specimen.id, { reviewer, verdicts, note });
    if (result.ok) onDone();
    else setError(result.error);
  };

  return (
    <div className="work-grid">
      <LabelPhoto label={specimen.label} collectionNo={specimen.collectionNo} />
      <div className="panel-inner">
        <h3>逐字段复核（判定与页面状态分开维护）</h3>
        <p className="hint">
          录入人：{specimen.claimedBy}。复核须由他人完成；任一字段判为不符即退回，旧稿保留。
        </p>

        <table className="compare-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>转录稿</th>
              <th>标签照片</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_KEYS.map((key) => {
              const v = verdicts.find((x) => x.field === key)!;
              const autoMatch = fieldEquals(key, typed[key], specimen.label[key]);
              return (
                <tr key={key} className={v.match ? "row-match" : "row-diff"}>
                  <td>{FIELD_LABELS[key]}</td>
                  <td className={autoMatch ? "" : "typed-diff"}>{typed[key] || "（空）"}</td>
                  <td>{specimen.label[key]}</td>
                  <td>
                    <button
                      className={`verdict ${v.match ? "is-match" : "is-diff"}`}
                      onClick={() => toggle(key)}
                    >
                      {v.match ? "一致" : "不符"}
                    </button>
                    {!autoMatch && v.match && <em className="override">人工改判</em>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <label className="inline-field">
          <span>复核人</span>
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="复核人姓名" />
        </label>
        <label className="inline-field column">
          <span>复核意见</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="退回时建议写明哪些字段与纸签不符" />
        </label>

        {selfReview && <p className="msg err">录入与复核分开：复核人不能是录入人本人。</p>}
        {allMatch && cabinetBusy && <p className="msg err">{cabinetBusy}，柜位不能先占，无法发证。</p>}
        {error && <p className="msg err">{error}</p>}

        <div className="btn-row">
          <button className={allMatch ? "primary" : "danger"} onClick={submit}>
            {allMatch ? "全部一致 · 发放馆藏号并锁定" : "存在不符字段 · 退回并保留旧稿"}
          </button>
        </div>
        <p className="hint">
          结论由五项判定自动得出：五项全部“一致”才发证并登记柜位；只要有一项“不符”即退回，当前转录稿原样保留。
        </p>
      </div>
    </div>
  );
}
