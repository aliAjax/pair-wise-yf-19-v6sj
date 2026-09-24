import { useState } from "react";
import type { Amendment, Specimen } from "../types";
import { FIELD_LABELS } from "../types";
import { useStore } from "../store/store";
import { STATUS_LABELS } from "../store/logic";
import { TranscribePanel } from "./TranscribePanel";
import { ReviewPanel } from "./ReviewPanel";

function formatTime(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function AmendmentReview({ specimen, amendment }: { specimen: Specimen; amendment: Amendment }) {
  const { staff, reviewAmendment } = useStore();
  const [reviewer, setReviewer] = useState(staff);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const self = reviewer.trim() === amendment.proposer;

  const decide = (approve: boolean) => {
    setError(null);
    const r = reviewAmendment(specimen.id, amendment.id, { reviewer, approve, note });
    if (!r.ok) setError(r.error);
  };

  return (
    <div className="amend-review">
      <label className="inline-field">
        <span>复核人</span>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
      </label>
      <label className="inline-field column">
        <span>复核意见</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {self && <p className="msg err">申请人与复核人须分开。</p>}
      {error && <p className="msg err">{error}</p>}
      <div className="btn-row">
        <button className="danger" onClick={() => decide(false)}>
          驳回（维持旧版与原柜位）
        </button>
        <button className="primary" onClick={() => decide(true)}>
          通过{amendment.kind === "cabinet" ? "（通过瞬间才换柜）" : "并重新锁定"}
        </button>
      </div>
    </div>
  );
}

function AmendmentsSection({ specimen }: { specimen: Specimen }) {
  const { state, staff, requestAmendment } = useStore();
  const [kind, setKind] = useState<"species" | "cabinet">("species");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = specimen.amendments.some((a) => a.status === "review");
  const current = specimen.locked ? specimen.locked[kind] : "";

  const freeCabinets = state.cabinets.filter(
    (code) => !state.specimens.some((o) => o.status === "archived" && o.locked?.cabinet === code),
  );

  const submit = () => {
    const r = requestAmendment(specimen.id, { kind, newValue, reason });
    if (r.ok) {
      setNewValue("");
      setReason("");
      setMessage({ ok: true, text: "变更申请已提交，须重新复核；审核期间原柜位不释放。" });
    } else setMessage({ ok: false, text: r.error });
  };

  return (
    <div className="amendments">
      <h3>锁定后的变更（改物种 / 柜位须写原因、重新复核）</h3>

      {!pending ? (
        <div className="amend-form">
          <div className="chips">
            <button className={kind === "species" ? "chip active" : "chip"} onClick={() => setKind("species")}>
              改物种（当前：{specimen.locked?.species}）
            </button>
            <button className={kind === "cabinet" ? "chip active" : "chip"} onClick={() => setKind("cabinet")}>
              改柜位（当前：{specimen.locked?.cabinet}）
            </button>
          </div>
          <label className="inline-field column">
            <span>{kind === "species" ? "新物种名称" : "新柜位"}</span>
            {kind === "cabinet" ? (
              <select value={newValue} onChange={(e) => setNewValue(e.target.value)}>
                <option value="">选择空闲柜位（不预占，复核通过才换）</option>
                {freeCabinets.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            ) : (
              <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={`当前锁定值：${current}`} />
            )}
          </label>
          <label className="inline-field column">
            <span>变更原因（必填）</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：复核拉丁名 / 柜体检修平移" />
          </label>
          <div className="btn-row">
            <button className="primary" onClick={submit}>
              提交变更申请
            </button>
            <span className="hint">当前身份：{staff || "（未填写）"}</span>
          </div>
        </div>
      ) : (
        <p className="hint">已有待复核的变更申请，结案前不能再申请。</p>
      )}
      {message && <p className={message.ok ? "msg ok" : "msg err"}>{message.text}</p>}

      <ul className="amend-list">
        {specimen.amendments.map((a) => (
          <li key={a.id} className={`amend-item amend-${a.status}`}>
            <div className="amend-head">
              <strong>
                {a.kind === "species" ? "物种变更" : "柜位变更"}：{a.oldValue} → {a.newValue}
              </strong>
              <span className={`status-badge amend-status-${a.status}`}>
                {a.status === "review" ? "待复核" : a.status === "approved" ? "已通过" : "已驳回"}
              </span>
            </div>
            <p className="hint">
              申请人 {a.proposer} · {formatTime(a.createdAt)} · 原因：{a.reason}
            </p>
            {a.status !== "review" && (
              <p className="hint">
                复核人 {a.reviewer} · {formatTime(a.reviewedAt)}
                {a.reviewNote ? ` · ${a.reviewNote}` : ""}
                {a.versionNo ? ` · 已生成版本 v${a.versionNo}` : ""}
              </p>
            )}
            {a.status === "review" && <AmendmentReview specimen={specimen} amendment={a} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DetailView({ specimen, onBack }: { specimen: Specimen; onBack: () => void }) {
  const locked = specimen.locked;

  return (
    <article className="panel detail-view">
      <div className="heading detail-head">
        <div>
          <p>单份标本详情</p>
          <h2>
            {specimen.collectionNo}
            {specimen.accessionNo && <span className="accession big">{specimen.accessionNo}</span>}
          </h2>
        </div>
        <div className="head-actions">
          <span className={`status-badge status-${specimen.status}`}>{STATUS_LABELS[specimen.status]}</span>
          <button onClick={onBack}>返回队列</button>
        </div>
      </div>

      {locked && (
        <section className="locked-box">
          <h3>已锁定字段（与标签照片一致）</h3>
          <div className="locked-grid">
            {(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map((key) => (
              <div key={key}>
                <small>{FIELD_LABELS[key]}</small>
                <b>{locked[key]}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {specimen.status !== "archived" && <TranscribePanel specimen={specimen} />}
      {specimen.status === "review" && <ReviewPanel specimen={specimen} onDone={onBack} />}

      {specimen.status === "archived" && <AmendmentsSection specimen={specimen} />}

      <section className="history">
        <h3>版本与复核留痕</h3>
        {specimen.versions.length === 0 && specimen.reviews.length === 0 && (
          <p className="hint">尚未建档，暂无锁定版本。</p>
        )}
        <ul className="timeline">
          {specimen.versions
            .map((v) => (
              <li key={`v${v.no}`} className="tl-version">
                <time>{formatTime(v.at)}</time>
                <div>
                  <strong>v{v.no} · {v.note}</strong>
                  <p>
                    {v.data.species}；{v.data.location}；{v.data.altitude}；{v.data.collector}；柜位 {v.data.cabinet}
                  </p>
                </div>
              </li>
            ))}
          {specimen.reviews.map((r) => (
            <li key={r.id} className={`tl-${r.result}`}>
              <time>{formatTime(r.at)}</time>
              <div>
                <strong>
                  复核{ r.result === "approved" ? "通过 · 已发证" : "退回 · 旧稿保留"}（{r.reviewer}）
                </strong>
                <p>
                  {r.verdicts.map((v) => `${FIELD_LABELS[v.field]}${v.match ? "一致" : "不符"}`).join("，")}
                </p>
                {r.note && <p className="hint">{r.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
