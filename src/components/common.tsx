import type { ReactNode } from "react";
import type { SpecimenStatus } from "../types";

export const STATUS_META: Record<
  SpecimenStatus,
  { text: string; cls: string }
> = {
  pending: { text: "待转录", cls: "st-pending" },
  transcribing: { text: "转录中", cls: "st-transcribing" },
  review: { text: "待复核", cls: "st-review" },
  archived: { text: "已馆藏", cls: "st-archived" },
  rejected: { text: "已退回", cls: "st-rejected" },
};

export function StatusBadge({ status }: { status: SpecimenStatus }) {
  const meta = STATUS_META[status];
  return <span className={`badge ${meta.cls}`}>{meta.text}</span>;
}

export function Panel({
  title,
  hint,
  extra,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="heading">
        <div>
          {hint ? <p className="hint">{hint}</p> : null}
          <h2>{title}</h2>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

const NAME_KEYS = {
  transcriber: "herbarium-transcriber-name",
  reviewer: "herbarium-reviewer-name",
};

export function loadName(role: keyof typeof NAME_KEYS): string {
  return localStorage.getItem(NAME_KEYS[role]) ?? "";
}

export function saveName(role: keyof typeof NAME_KEYS, value: string) {
  localStorage.setItem(NAME_KEYS[role], value);
}

export function RoleInput({
  role,
  label,
  value,
  onChange,
}: {
  role: keyof typeof NAME_KEYS;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="role-input">
      <span>{label}</span>
      <input
        value={value}
        placeholder={`填写${label}姓名`}
        onChange={(e) => {
          onChange(e.target.value);
          saveName(role, e.target.value);
        }}
      />
    </label>
  );
}
