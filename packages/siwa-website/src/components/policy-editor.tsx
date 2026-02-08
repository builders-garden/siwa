"use client";

import { useState, useEffect } from "react";
import { Policy, PolicyRule } from "@/lib/policy-types";

interface PolicyEditorProps {
  policy: Policy | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (policy: Policy) => void;
}

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "regex", label: "matches regex" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater or equal" },
  { value: "lte", label: "less or equal" },
] as const;

function generateId() {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function PolicyEditor({ policy, isOpen, onClose, onSave }: PolicyEditorProps) {
  const [formData, setFormData] = useState<Omit<Policy, "id" | "createdAt" | "updatedAt">>({
    name: "",
    description: "",
    type: "allow",
    scope: "global",
    rules: [],
    status: "draft",
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name,
        description: policy.description,
        type: policy.type,
        scope: policy.scope,
        rules: [...policy.rules],
        status: policy.status,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        type: "allow",
        scope: "global",
        rules: [],
        status: "draft",
      });
    }
  }, [policy, isOpen]);

  const addRule = () => {
    setFormData((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        { id: generateId(), field: "", operator: "equals", value: "" },
      ],
    }));
  };

  const updateRule = (index: number, updates: Partial<PolicyRule>) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === index ? { ...rule, ...updates } : rule
      ),
    }));
  };

  const removeRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const savedPolicy: Policy = {
      id: policy?.id || `pol_${Date.now()}`,
      ...formData,
      createdAt: policy?.createdAt || now,
      updatedAt: now,
    };
    onSave(savedPolicy);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            {policy ? "Edit Policy" : "Create Policy"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted hover:text-foreground hover:bg-surface transition-colors duration-200 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Policy Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200"
              placeholder="Enter policy name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200 resize-none"
              placeholder="Describe what this policy does"
              rows={3}
              required
            />
          </div>

          {/* Type and Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as Policy["type"] }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200 cursor-pointer"
              >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Scope
              </label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData((prev) => ({ ...prev, scope: e.target.value as Policy["scope"] }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200 cursor-pointer"
              >
                <option value="global">Global</option>
                <option value="agent">Agent</option>
                <option value="action">Action</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Status
            </label>
            <div className="flex gap-3">
              {(["draft", "active", "disabled"] as const).map((status) => (
                <label
                  key={status}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors duration-200 ${
                    formData.status === status
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface text-muted hover:border-dim"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={formData.status === status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Policy["status"] }))}
                    className="sr-only"
                  />
                  <span className="capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">
                Rules
              </label>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:border-dim transition-colors duration-200 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add Rule
              </button>
            </div>

            {formData.rules.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
                <p className="text-sm text-dim">No rules defined yet</p>
                <p className="text-xs text-dim mt-1">Add rules to specify policy conditions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="rounded-md border border-border bg-surface p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={rule.field}
                          onChange={(e) => updateRule(index, { field: e.target.value })}
                          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder-dim focus:border-accent focus:outline-none transition-colors duration-200"
                          placeholder="field_name"
                        />
                        <select
                          value={rule.operator}
                          onChange={(e) => updateRule(index, { operator: e.target.value as PolicyRule["operator"] })}
                          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none transition-colors duration-200 cursor-pointer"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground placeholder-dim focus:border-accent focus:outline-none transition-colors duration-200"
                          placeholder="value"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        className="rounded p-1 text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground hover:border-dim transition-colors duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors duration-200 cursor-pointer"
            >
              {policy ? "Save Changes" : "Create Policy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
