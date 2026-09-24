import { useState } from "react";
import type { ActionResult, FieldData, FieldKey, Specimen } from "../types";
import { emptyDraft, FIELD_KEYS, FIELD_LABELS } from "../types";
import { useStore } from "../store/store";
import { LabelPhoto } from "./LabelPhoto";

export function TranscribePanel({ specimen }: { specimen: Specimen }) {
  const { staff, claim, saveDraft, submitDraft } = useStore();
  const [form, setForm] = useState<FieldData>(() => specimen.draft ?? emptyDraft());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const readOnly = specimen.status === "review" || specimen.status === "archived";
  const mine = specimen.claimedBy === staff.trim();

  const set = (key: FieldKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const notify = (r: ActionResult, okText: string) => {
    if (r.ok) setMessage({ ok: true, text: okText });
    else setMessage({ ok: false, text: r.error });
  };

  if (specimen.status === "waiting") {
    return (
      <div className="work-grid">
        <LabelPhoto label={specimen.label} collectionNo={specimen.collectionNo} />
        <div className="panel-inner">
          <h3>按采集号领取</h3>
          <p className="hint">领取后转录稿只保存在本地数据中，可随时关闭页面，重开继续。</p>
          <button
            className="primary"
            onClick={() => notify(claim(specimen.id), `已以「${staff}」领取 ${specimen.collectionNo}`)}
          >
            领取并开始转录
          </button>
          {message && <p className={message.ok ? "msg ok" : "msg err"}>{message.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="work-grid">
      <LabelPhoto label={specimen.label} collectionNo={specimen.collectionNo} />
      <div className="panel-inner">
        <h3>{specimen.status === "returned" ? "按退回意见改录（旧稿保留）" : "转录纸签"}</h3>
        {specimen.status === "returned" && specimen.reviews[specimen.reviews.length - 1] && (
          <div className="return-note">
            <strong>上次复核退回意见：</strong>
            {specimen.reviews[specimen.reviews.length - 1].note || "存在与纸签不符的字段。"}
          </div>
        )}
        <div className="field-form">
          {FIELD_KEYS.map((key) => (
            <label key={key}>
              <span>{FIELD_LABELS[key]}</span>
              <input
                value={form[key]}
                disabled={readOnly}
                placeholder={`照纸签抄录${FIELD_LABELS[key]}`}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>

        {specimen.status === "review" && (
          <p className="hint">已提交复核，等待复核人逐字段对照标签照片。柜位在通过前不预占。</p>
        )}
        {!mine && !readOnly && (
          <p className="hint">该标本由 {specimen.claimedBy} 领取，只有领取人可改录。</p>
        )}

        {!readOnly && (
          <div className="btn-row">
            <button onClick={() => notify(saveDraft(specimen.id, form), "草稿已保存到本地数据")}>
              保存草稿
            </button>
            <button className="primary" onClick={() => notify(submitDraft(specimen.id), "已提交复核")}>
              提交复核
            </button>
          </div>
        )}
        {message && <p className={message.ok ? "msg ok" : "msg err"}>{message.text}</p>}
      </div>
    </div>
  );
}
