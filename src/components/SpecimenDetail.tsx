import { useMemo, useState } from "react";
import type { LabelField, Specimen } from "../types";
import {
  LABEL_FIELDS,
  isCabinetFree,
  normalizeCabinet,
} from "../store";
import { StatusBadge, loadName } from "./common";

interface DetailProps {
  specimen: Specimen;
  allSpecimens: Specimen[];
  heldCells: string[];
  onBack: () => void;
  onRequest: (
    id: string,
    field: LabelField | "cabinet",
    value: string,
    reason: string,
    by: string
  ) => boolean;
  onReviewAmendment: (
    specimenId: string,
    amendmentId: string,
    approve: boolean,
    reviewer: string,
    note?: string
  ) => void;
}

export function SpecimenDetail({
  specimen: s,
  allSpecimens,
  heldCells,
  onBack,
  onRequest,
  onReviewAmendment,
}: DetailProps) {
  const [by, setBy] = useState(() => loadName("transcriber"));
  const [reviewer, setReviewer] = useState(() => loadName("reviewer"));

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>
        ← 返回队列
      </button>

      <section className="panel detail-head">
        <div>
          <p className="hint">单份标本详情</p>
          <h2>
            {s.collectionNo}
            {s.accessionNo && <span className="acc">{s.accessionNo}</span>}
          </h2>
          <div className="detail-tags">
            <StatusBadge status={s.status} />
            {s.assignee && <span className="muted">领取 / 录入：{s.assignee}</span>}
            {s.assignedAt && <span className="muted">领取于 {s.assignedAt}</span>}
            {s.archivedAt && <span className="muted">馆藏于 {s.archivedAt}</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p className="hint">纸签照片内容（真值）</p>
            <h2>标签与转录对照</h2>
          </div>
        </div>
        <table className="detail-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>标签照片</th>
              <th>{s.locked ? "锁定的原字段" : "当前录入 / 提交版"}</th>
            </tr>
          </thead>
          <tbody>
            {LABEL_FIELDS.map((f) => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>{s.label[f.key]}</td>
                <td>{s.locked ? s.locked[f.key] : s.draft[f.key] || <em>（空）</em>}</td>
              </tr>
            ))}
            <tr>
              <td>柜位</td>
              <td>{s.label.cabinet}</td>
              <td>
                {s.locked ? s.locked.cabinet : s.draft.cabinet || <em>（未填）</em>}
                {s.status !== "archived" && (
                  <small className="cab-hint"> 未发号前不占用</small>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {s.status === "archived" && s.locked && (
        <AmendmentSection
          specimen={s}
          allSpecimens={allSpecimens}
          heldCells={heldCells}
          by={by}
          reviewer={reviewer}
          setBy={setBy}
          setReviewer={setReviewer}
          onRequest={onRequest}
          onReview={onReviewAmendment}
        />
      )}

      <section className="panel">
        <div className="heading">
          <div>
            <p className="hint">留痕</p>
            <h2>复核与变更历史</h2>
          </div>
        </div>
        {s.reviews.length === 0 && s.amendments.length === 0 ? (
          <p className="empty">暂无复核记录。</p>
        ) : (
          <ol className="timeline">
            {s.reviews
              .slice()
              .reverse()
              .map((r) => (
                <li key={r.id} className={r.result === "approve" ? "ok" : "bad"}>
                  <div className="tl-head">
                    <b>{r.kind === "initial" ? "初核" : "变更复核"}</b>
                    <span
                      className={
                        r.result === "approve" ? "verdict-ok" : "verdict-bad"
                      }
                    >
                      {r.result === "approve" ? "通过" : "退回 / 驳回"}
                    </span>
                    <span className="muted">{r.at} · {r.reviewer}</span>
                  </div>
                  {r.kind === "initial" && (
                    <div className="verdicts">
                      {LABEL_FIELDS.map((f) => (
                        <span
                          key={f.key}
                          className={
                            r.verdicts?.[f.key] === "match"
                              ? "tag ok"
                              : "tag bad"
                          }
                        >
                          {f.label}
                          {r.verdicts?.[f.key] === "match" ? "一致" : "不符"}
                        </span>
                      ))}
                      <span className={r.cabinetOk ? "tag ok" : "tag bad"}>
                        柜位{r.cabinetOk ? "可用" : "不可用"}
                      </span>
                    </div>
                  )}
                  {r.kind === "amendment" && r.before && r.changed && (
                    <div className="change-pair">
                      <span className="old">
                        {fieldName(Object.keys(r.before)[0])}：
                        {Object.values(r.before)[0]}
                      </span>
                      <span> → </span>
                      <span className="new">{Object.values(r.changed)[0]}</span>
                      <p className="muted">原因：{r.reason}</p>
                    </div>
                  )}
                  {r.note && <p className="tl-note">{r.note}</p>}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function fieldName(key: string): string {
  const map: Record<string, string> = {
    species: "物种",
    location: "地点",
    altitude: "海拔",
    collector: "采集人",
    cabinet: "柜位",
  };
  return map[key] ?? key;
}

function AmendmentSection({
  specimen: s,
  allSpecimens,
  heldCells,
  by,
  reviewer,
  setBy,
  setReviewer,
  onRequest,
  onReview,
}: {
  specimen: Specimen;
  allSpecimens: Specimen[];
  heldCells: string[];
  by: string;
  reviewer: string;
  setBy: (v: string) => void;
  setReviewer: (v: string) => void;
  onRequest: DetailProps["onRequest"];
  onReview: DetailProps["onReviewAmendment"];
}) {
  const [field, setField] = useState<LabelField | "cabinet">("species");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const pending = s.amendments.filter((a) => a.status === "pending_review");
  const target = field === "cabinet" ? normalizeCabinet(value) : value.trim();
  const busy =
    field === "cabinet" && target
      ? !isCabinetFree(allSpecimens, target, s.id) ||
        heldCells.includes(target)
      : false;

  const submit = () => {
    const ok = onRequest(s.id, field, value, reason, by);
    if (ok) {
      setValue("");
      setReason("");
      setMsg("变更申请已提交，等待重新复核；在此之前原柜位保持占用。");
    } else {
      setMsg("提交失败：请填写新值、变更原因和申请人，或该字段已有待复核申请。");
    }
  };

  return (
    <section className="panel amend">
      <div className="heading">
        <div>
          <p className="hint">已馆藏 · 原字段锁定</p>
          <h2>物种 / 柜位变更</h2>
        </div>
      </div>
      <p className="muted rule">
        规则：改物种或柜位必须写明原因并重新复核；柜位变更获批后原柜位
        <b> 暂不释放</b>，由人工在柜位记录中确认后释放。
      </p>

      <div className="amend-grid">
        <div className="amend-form">
          <label className="role-input">
            <span>申请人</span>
            <input
              value={by}
              onChange={(e) => setBy(e.target.value)}
              placeholder="填写标本员姓名"
            />
          </label>
          <label>
            <span>变更字段</span>
            <select
              value={field}
              onChange={(e) => {
                setField(e.target.value as LabelField | "cabinet");
                setMsg(null);
              }}
            >
              <option value="species">物种（species）</option>
              <option value="cabinet">柜位（cabinet）</option>
            </select>
          </label>
          <label>
            <span>现值（锁定）</span>
            <input value={s.locked![field]} disabled />
          </label>
          <label>
            <span>新值</span>
            <input
              value={value}
              placeholder={field === "cabinet" ? "如 C-03-11" : "新物种名称"}
              onChange={(e) => {
                setValue(e.target.value);
                setMsg(null);
              }}
            />
            {field === "cabinet" && target && (
              <small className={busy ? "cab-warn" : "cab-hint"}>
                {busy
                  ? `⚠ ${target} 已占用或处于暂留，复核将不能通过`
                  : `${target} 当前空闲`}
              </small>
            )}
          </label>
          <label>
            <span>变更原因（必填）</span>
            <textarea
              rows={2}
              value={reason}
              placeholder="如：专家复核更正为同属另一种 / 实物转移至干燥柜"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button
              className="primary"
              disabled={!by.trim() || !target || !reason.trim() || busy}
              onClick={submit}
            >
              提交变更并重新复核
            </button>
            {msg && <small className="cab-hint">{msg}</small>}
          </div>
        </div>

        <div className="amend-review">
          <h4>待复核变更（{pending.length}）</h4>
          {pending.length === 0 && <p className="empty">暂无待复核变更。</p>}
          <label className="role-input">
            <span>复核员（须与申请人不同）</span>
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="填写复核员姓名"
            />
          </label>
          {pending.map((a) => {
            const same = reviewer.trim() && reviewer.trim() === a.requestedBy;
            const aBusy =
              a.field === "cabinet" &&
              (!isCabinetFree(allSpecimens, a.newValue, s.id) ||
                heldCells.includes(normalizeCabinet(a.newValue)));
            return (
              <article key={a.id} className="amend-item">
                <div className="amend-item-head">
                  <b>{fieldName(a.field)}变更</b>
                  <span className="muted">{a.requestedAt} · {a.requestedBy}</span>
                </div>
                <p>
                  <span className="old">{a.oldValue}</span> →{" "}
                  <span className="new">{a.newValue}</span>
                </p>
                <p className="muted">原因：{a.reason}</p>
                {a.field === "cabinet" && (
                  <small className={aBusy ? "cab-warn" : "cab-hint"}>
                    {aBusy
                      ? `⚠ 新柜位 ${a.newValue} 不可用`
                      : `新柜位 ${a.newValue} 可用；通过后原柜位 ${a.oldValue} 暂留`}
                  </small>
                )}
                {same && (
                  <p className="reject-tip">⚠ 复核员不能与申请人为同一人。</p>
                )}
                <div className="row-actions">
                  <button
                    className="danger"
                    disabled={!reviewer.trim() || !!same}
                    onClick={() => onReview(s.id, a.id, false, reviewer, "变更复核驳回")}
                  >
                    驳回
                  </button>
                  <button
                    className="primary"
                    disabled={!reviewer.trim() || !!same || aBusy}
                    onClick={() =>
                      onReview(s.id, a.id, true, reviewer, "变更复核通过")
                    }
                  >
                    复核通过
                  </button>
                </div>
              </article>
            );
          })}

          <h4>历次变更</h4>
          {s.amendments
            .filter((a) => a.status !== "pending_review")
            .reverse()
            .map((a) => (
              <p key={a.id} className="amend-history">
                <span className={`tag ${a.status === "approved" ? "ok" : "bad"}`}>
                  {a.status === "approved" ? "已通过" : "已驳回"}
                </span>
                {fieldName(a.field)}：{a.oldValue} → {a.newValue}
                <small className="muted">（{a.reason}）</small>
              </p>
            ))}
        </div>
      </div>
    </section>
  );
}
