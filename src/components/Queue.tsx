import { useMemo, useState } from "react";
import type {
  FieldVerdict,
  LabelField,
  LabelInfo,
  Specimen,
  SpecimenStatus,
} from "../types";
import { LABEL_FIELDS, normalizeCabinet } from "../store";
import type { InitialReviewInput } from "../useStore";
import { Panel, StatusBadge, loadName } from "./common";

const FILTERS: { key: SpecimenStatus | "all" | "active"; text: string }[] = [
  { key: "all", text: "全部" },
  { key: "pending", text: "待转录" },
  { key: "transcribing", text: "转录中" },
  { key: "review", text: "待复核" },
  { key: "rejected", text: "已退回" },
  { key: "archived", text: "已馆藏" },
  { key: "active", text: "在办队列" },
];

interface QueueProps {
  specimens: Specimen[];
  cabinetBusy: (cell: string, selfId?: string) => boolean;
  onClaim: (id: string, name: string) => void;
  onSaveDraft: (id: string, patch: Partial<LabelInfo>) => void;
  onSubmit: (id: string) => void;
  onReview: (id: string, input: InitialReviewInput) => void;
  onOpen: (id: string) => void;
}

export function Queue({
  specimens,
  cabinetBusy,
  onClaim,
  onSaveDraft,
  onSubmit,
  onReview,
  onOpen,
}: QueueProps) {
  const [filter, setFilter] = useState<SpecimenStatus | "all" | "active">(
    "active"
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcriber, setTranscriber] = useState(() =>
    loadName("transcriber")
  );
  const [reviewer, setReviewer] = useState(() => loadName("reviewer"));

  const list = useMemo(() => {
    return specimens.filter((s) => {
      if (filter === "all") return true;
      if (filter === "active") return s.status !== "archived";
      return s.status === filter;
    });
  }, [specimens, filter]);

  return (
    <Panel
      title="转录入库队列"
      hint="按采集号领取"
      extra={
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "chip on" : "chip"}
              onClick={() => setFilter(f.key)}
            >
              {f.text}
            </button>
          ))}
        </div>
      }
    >
      <div className="role-bar">
        <label className="role-input">
          <span>标本员（录入）</span>
          <input
            value={transcriber}
            placeholder="填写标本员姓名"
            onChange={(e) => {
              setTranscriber(e.target.value);
              localStorage.setItem(
                "herbarium-transcriber-name",
                e.target.value
              );
            }}
          />
        </label>
        <label className="role-input">
          <span>复核员（与录入分开）</span>
          <input
            value={reviewer}
            placeholder="填写复核员姓名"
            onChange={(e) => {
              setReviewer(e.target.value);
              localStorage.setItem("herbarium-reviewer-name", e.target.value);
            }}
          />
        </label>
      </div>

      <div className="queue">
        {list.length === 0 && <p className="empty">该筛选下暂无标本。</p>}
        {list.map((s) => {
          const open = openId === s.id;
          const samePerson =
            !!reviewer.trim() && reviewer.trim() === s.assignee;
          return (
            <article
              key={s.id}
              className={open ? "queue-item open" : "queue-item"}
            >
              <header
                className="queue-head"
                onClick={() => setOpenId(open ? null : s.id)}
              >
                <div className="queue-id">
                  <b>{s.collectionNo}</b>
                  {s.accessionNo && <span className="acc">{s.accessionNo}</span>}
                </div>
                <div className="queue-meta">
                  <StatusBadge status={s.status} />
                  <span>{s.assignee ? `领取：${s.assignee}` : "尚未领取"}</span>
                  <span className="chev">{open ? "收起 ▴" : "处理 ▾"}</span>
                </div>
              </header>

              {open && (
                <div className="queue-body">
                  {s.status === "pending" && (
                    <ClaimBox
                      transcriber={transcriber}
                      onClaim={() => onClaim(s.id, transcriber)}
                    />
                  )}

                  {(s.status === "transcribing" || s.status === "rejected") && (
                    <TranscribeBox
                      specimen={s}
                      cabinetBusy={(cell) => cabinetBusy(cell, s.id)}
                      onSave={(patch) => onSaveDraft(s.id, patch)}
                      onSubmit={() => onSubmit(s.id)}
                      onOpenDetail={() => onOpen(s.id)}
                    />
                  )}

                  {s.status === "review" && (
                    <ReviewBox
                      specimen={s}
                      reviewer={reviewer}
                      samePerson={samePerson}
                      cabinetBusy={(cell) => cabinetBusy(cell, s.id)}
                      onReview={(input) => onReview(s.id, input)}
                    />
                  )}

                  {s.status === "archived" && (
                    <div className="archived-note">
                      <p>
                        馆藏号 <b>{s.accessionNo}</b> 已于 {s.archivedAt} 发放，
                        原字段已锁定并上柜 <b>{s.locked?.cabinet}</b>。
                      </p>
                      <button className="link-btn" onClick={() => onOpen(s.id)}>
                        查看详情 / 发起物种或柜位变更 →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function ClaimBox({
  transcriber,
  onClaim,
}: {
  transcriber: string;
  onClaim: () => void;
}) {
  return (
    <div className="claim-box">
      <p>该标本还在待转录队列，标本员按采集号领取后才能录入。</p>
      <button
        className="primary"
        disabled={!transcriber.trim()}
        onClick={onClaim}
      >
        {transcriber.trim() ? `由 ${transcriber.trim()} 领取并录入` : "先在上方填写标本员姓名"}
      </button>
    </div>
  );
}

function TranscribeBox({
  specimen,
  cabinetBusy,
  onSave,
  onSubmit,
  onOpenDetail,
}: {
  specimen: Specimen;
  cabinetBusy: (cell: string) => boolean;
  onSave: (patch: Partial<LabelInfo>) => void;
  onSubmit: () => void;
  onOpenDetail: () => void;
}) {
  const [form, setForm] = useState<LabelInfo>({ ...specimen.draft });
  const [savedTip, setSavedTip] = useState(false);

  const update = (key: keyof LabelInfo, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    onSave({ [key]: value });
    setSavedTip(true);
    window.setTimeout(() => setSavedTip(false), 1200);
  };

  const complete =
    form.species.trim() &&
    form.location.trim() &&
    form.altitude.trim() &&
    form.collector.trim() &&
    form.cabinet.trim();
  const cell = normalizeCabinet(form.cabinet);
  const busy = cell ? cabinetBusy(cell) : false;

  return (
    <div className="work-box">
      <div className="box-columns">
        <div className="label-photo">
          <h4>纸签照片（真值）</h4>
          <PhotoCard specimen={specimen} />
        </div>
        <div className="entry-form">
          <h4>录入区{specimen.status === "rejected" && "（退回后重录，旧版已保留）"}</h4>
          {specimen.status === "rejected" && specimen.lastRejectNote && (
            <p className="reject-tip">↩ {specimen.lastRejectNote}</p>
          )}
          <div className="field-grid">
            {LABEL_FIELDS.map((f) => (
              <label key={f.key}>
                <span>{f.label}</span>
                <input
                  value={form[f.key]}
                  placeholder={`抄录${f.label}`}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              </label>
            ))}
            <label>
              <span>柜位（提交时仅登记，不预占）</span>
              <input
                value={form.cabinet}
                placeholder="如 B-12-04"
                onChange={(e) => update("cabinet", e.target.value)}
              />
              {cell && (
                <small className={busy ? "cab-warn" : "cab-hint"}>
                  {busy
                    ? `⚠ ${cell} 当前已被馆藏标本占用，复核将无法通过`
                    : `柜位号规范化为 ${cell}，复核全过后才正式占用`}
                </small>
              )}
            </label>
          </div>
          <div className="row-actions">
            <span className="save-tip">{savedTip ? "草稿已自动保存到本地" : "　"}</span>
            <button onClick={onOpenDetail}>查看标签详情</button>
            <button
              className="primary"
              disabled={!complete}
              onClick={onSubmit}
            >
              提交复核
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoCard({ specimen }: { specimen: Specimen }) {
  return (
    <div className="photo-card">
      <div className="photo-head">
        <span>采集号</span>
        <b>{specimen.collectionNo}</b>
      </div>
      <dl>
        {LABEL_FIELDS.map((f) => (
          <div key={f.key} className="photo-row">
            <dt>{f.label}</dt>
            <dd>{specimen.label[f.key]}</dd>
          </div>
        ))}
        <div className="photo-row">
          <dt>标签标注柜位</dt>
          <dd>{specimen.label.cabinet}</dd>
        </div>
      </dl>
    </div>
  );
}

function ReviewBox({
  specimen,
  reviewer,
  samePerson,
  cabinetBusy,
  onReview,
}: {
  specimen: Specimen;
  reviewer: string;
  samePerson: boolean;
  cabinetBusy: (cell: string) => boolean;
  onReview: (input: InitialReviewInput) => void;
}) {
  const [verdicts, setVerdicts] = useState<Record<LabelField, FieldVerdict>>({
    species: "match",
    location: "match",
    altitude: "match",
    collector: "match",
  });
  const [note, setNote] = useState("");

  const cell = normalizeCabinet(specimen.draft.cabinet);
  const busy = cabinetBusy(cell);

  const submit = (approve: boolean) => {
    onReview({
      reviewer,
      verdicts,
      cabinetOk: !busy,
      note:
        note.trim() ||
        (approve
          ? "四字段与标签照片一致，柜位可用，发号上柜。"
          : "复核未通过，退回转录并保留旧版。"),
    });
  };

  const anyMismatch = Object.values(verdicts).some((v) => v === "mismatch");

  return (
    <div className="work-box">
      <div className="box-columns">
        <div className="label-photo">
          <h4>纸签照片（真值）</h4>
          <PhotoCard specimen={specimen} />
        </div>
        <div className="entry-form">
          <h4>复核判定（校录判定独立于页面状态）</h4>
          <table className="compare-table">
            <thead>
              <tr>
                <th>字段</th>
                <th>录入内容</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {LABEL_FIELDS.map((f) => {
                const entered = specimen.draft[f.key];
                const v = verdicts[f.key];
                return (
                  <tr key={f.key} className={v === "mismatch" ? "row-bad" : ""}>
                    <td>{f.label}</td>
                    <td>{entered || <em>（空）</em>}</td>
                    <td>
                      <div className="verdict-toggle">
                        <button
                          className={v === "match" ? "ok on" : "ok"}
                          onClick={() =>
                            setVerdicts((p) => ({ ...p, [f.key]: "match" }))
                          }
                        >
                          一致
                        </button>
                        <button
                          className={v === "mismatch" ? "bad on" : "bad"}
                          onClick={() =>
                            setVerdicts((p) => ({ ...p, [f.key]: "mismatch" }))
                          }
                        >
                          不符
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className={busy ? "row-bad" : ""}>
                <td>柜位</td>
                <td>
                  {cell}
                  <br />
                  <small className={busy ? "cab-warn" : "cab-hint"}>
                    {busy
                      ? `⚠ ${cell} 已被其他馆藏标本占用`
                      : `${cell} 当前空闲，可用`}
                  </small>
                </td>
                <td>
                  <span className={busy ? "cab-warn" : "cab-hint"}>
                    {busy ? "不可用" : "可用（系统实时判定）"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <label className="note-field">
            <span>复核备注</span>
            <input
              value={note}
              placeholder="退回时可写明哪个字段与照片不符"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          {samePerson && (
            <p className="reject-tip">
              ⚠ 录入与复核须分开：当前复核员就是该标本的领取人，请换人复核。
            </p>
          )}

          <div className="row-actions">
            <button
              className="danger"
              disabled={!reviewer.trim() || samePerson}
              onClick={() => submit(false)}
            >
              退回（保留旧版）
            </button>
            <button
              className="primary"
              disabled={!reviewer.trim() || samePerson || anyMismatch || busy}
              onClick={() => submit(true)}
            >
              全部一致 · 发馆藏号上柜
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
