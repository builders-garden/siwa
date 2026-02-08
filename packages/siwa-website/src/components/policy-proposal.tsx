"use client";

import { PolicyProposal } from "@/lib/policy-types";

interface PolicyProposalCardProps {
  proposal: PolicyProposal;
  onAccept: (proposal: PolicyProposal) => void;
  onDismiss: (proposalId: string) => void;
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const getColor = () => {
    if (confidence >= 0.85) return "bg-green-500";
    if (confidence >= 0.7) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-mono text-dim">{percentage}%</span>
    </div>
  );
}

function RulePreview({ rules }: { rules: PolicyProposal["policy"]["rules"] }) {
  return (
    <div className="rounded-md border border-border bg-background p-3 font-mono text-xs">
      {rules.map((rule, i) => (
        <div key={rule.id} className="flex items-center gap-2">
          {i > 0 && <span className="text-accent">AND</span>}
          <span className="text-muted">{rule.field}</span>
          <span className="text-purple-400">{rule.operator}</span>
          <span className="text-foreground">&quot;{rule.value}&quot;</span>
        </div>
      ))}
    </div>
  );
}

export function PolicyProposalCard({
  proposal,
  onAccept,
  onDismiss,
}: PolicyProposalCardProps) {
  const typeColors = {
    allow: "text-accent",
    deny: "text-red-400",
    limit: "text-purple-400",
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-accent"
          >
            <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
          </svg>
          <span className="text-xs font-medium text-accent uppercase tracking-wide">
            AI Suggested
          </span>
        </div>
        <button
          onClick={() => onDismiss(proposal.id)}
          className="rounded p-1 text-muted hover:text-foreground hover:bg-surface transition-colors duration-200 cursor-pointer"
          title="Dismiss suggestion"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <h3 className="font-mono text-base font-semibold text-foreground mb-2">
        {proposal.name}
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-4">
        {proposal.description}
      </p>

      {/* Rationale */}
      <div className="rounded-md border border-border bg-surface/50 p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-dim"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-medium text-dim uppercase tracking-wide">
            Why this suggestion
          </span>
        </div>
        <p className="text-sm text-muted leading-relaxed">{proposal.rationale}</p>
      </div>

      {/* Policy Preview */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-mono text-xs font-semibold uppercase ${typeColors[proposal.policy.type]}`}>
            {proposal.policy.type}
          </span>
          <span className="text-dim">|</span>
          <span className="text-xs text-dim">{proposal.policy.scope} scope</span>
        </div>
        <RulePreview rules={proposal.policy.rules} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {proposal.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-surface px-2 py-0.5 text-xs text-dim"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Confidence & Actions */}
      <div className="border-t border-border pt-4">
        <div className="mb-3">
          <span className="text-xs text-dim mb-1 block">Confidence</span>
          <ConfidenceMeter confidence={proposal.confidence} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAccept(proposal)}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors duration-200 cursor-pointer"
          >
            Accept & Create
          </button>
          <button
            onClick={() => onDismiss(proposal.id)}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:border-dim transition-colors duration-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
