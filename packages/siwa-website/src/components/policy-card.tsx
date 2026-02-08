"use client";

import { Policy } from "@/lib/policy-types";

interface PolicyCardProps {
  policy: Policy;
  onEdit: (policy: Policy) => void;
  onToggleStatus: (policy: Policy) => void;
}

function StatusBadge({ status }: { status: Policy["status"] }) {
  const styles = {
    active: "bg-green-500/10 text-green-400 border-green-500/30",
    draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    disabled: "bg-dim/10 text-dim border-dim/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: Policy["type"] }) {
  const styles = {
    allow: "bg-accent/10 text-accent border-accent/30",
    deny: "bg-red-500/10 text-red-400 border-red-500/30",
    limit: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono font-medium uppercase ${styles[type]}`}
    >
      {type}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: Policy["scope"] }) {
  return (
    <span className="inline-flex items-center rounded bg-surface px-1.5 py-0.5 text-xs font-mono text-muted">
      {scope}
    </span>
  );
}

export function PolicyCard({ policy, onEdit, onToggleStatus }: PolicyCardProps) {
  const formattedDate = new Date(policy.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="group rounded-lg border border-border bg-surface p-5 transition-colors duration-200 hover:border-dim">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={policy.type} />
          <ScopeBadge scope={policy.scope} />
          <StatusBadge status={policy.status} />
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onToggleStatus(policy)}
            className="rounded p-1.5 text-muted hover:text-foreground hover:bg-border transition-colors duration-200 cursor-pointer"
            title={policy.status === "active" ? "Disable policy" : "Enable policy"}
          >
            {policy.status === "active" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onEdit(policy)}
            className="rounded p-1.5 text-muted hover:text-accent hover:bg-accent/10 transition-colors duration-200 cursor-pointer"
            title="Edit policy"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-mono text-base font-semibold text-foreground mb-2">
        {policy.name}
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-4">
        {policy.description}
      </p>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-xs text-dim">
          <span className="font-mono">
            {policy.rules.length} rule{policy.rules.length !== 1 ? "s" : ""}
          </span>
          <span>Updated {formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
