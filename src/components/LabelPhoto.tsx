import type { FieldData } from "../types";
import { FIELD_LABELS } from "../types";

/** 纸签照片：字段权威值。所有复核判定只以此为准。 */
export function LabelPhoto({ label, collectionNo }: { label: FieldData; collectionNo: string }) {
  return (
    <figure className="label-photo">
      <figcaption>
        <span className="pin" />
        标签照片 · {collectionNo}
      </figcaption>
      <dl>
        {(Object.keys(FIELD_LABELS) as (keyof FieldData)[]).map((key) => (
          <div key={key}>
            <dt>{FIELD_LABELS[key]}</dt>
            <dd>{label[key] || "—"}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
