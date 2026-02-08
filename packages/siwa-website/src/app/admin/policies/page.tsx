"use client";

import { useState, useMemo } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { PolicyCard } from "@/components/policy-card";
import { PolicyEditor } from "@/components/policy-editor";
import { PolicyProposalCard } from "@/components/policy-proposal";
import {
  Policy,
  PolicyProposal,
  samplePolicies,
  proposedPolicies,
} from "@/lib/policy-types";

type FilterType = "all" | "active" | "draft" | "disabled";
type SortBy = "updated" | "name" | "type";

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>(samplePolicies);
  const [proposals, setProposals] = useState<PolicyProposal[]>(proposedPolicies);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [showProposals, setShowProposals] = useState(true);

  // Filter and sort policies
  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    // Filter by status
    if (filter !== "all") {
      result = result.filter((p) => p.status === filter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "type":
          return a.type.localeCompare(b.type);
        case "updated":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [policies, filter, searchQuery, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const active = policies.filter((p) => p.status === "active").length;
    const draft = policies.filter((p) => p.status === "draft").length;
    const disabled = policies.filter((p) => p.status === "disabled").length;
    return { total: policies.length, active, draft, disabled };
  }, [policies]);

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setIsEditorOpen(true);
  };

  const handleEditPolicy = (policy: Policy) => {
    setEditingPolicy(policy);
    setIsEditorOpen(true);
  };

  const handleToggleStatus = (policy: Policy) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policy.id
          ? {
              ...p,
              status: p.status === "active" ? "disabled" : "active",
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const handleSavePolicy = (policy: Policy) => {
    setPolicies((prev) => {
      const exists = prev.find((p) => p.id === policy.id);
      if (exists) {
        return prev.map((p) => (p.id === policy.id ? policy : p));
      }
      return [policy, ...prev];
    });
  };

  const handleAcceptProposal = (proposal: PolicyProposal) => {
    const newPolicy: Policy = {
      id: `pol_${Date.now()}`,
      ...proposal.policy,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPolicies((prev) => [newPolicy, ...prev]);
    setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
  };

  const handleDismissProposal = (proposalId: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== proposalId));
  };

  return (
    <div className="mx-auto flex max-w-6xl px-6 py-12">
      <AdminSidebar />

      <main className="min-w-0 flex-1 pl-0 md:pl-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-mono text-2xl font-bold text-foreground mb-1">
              Policies
            </h1>
            <p className="text-sm text-dim">
              Manage access control and security policies for your agents
            </p>
          </div>
          <button
            onClick={handleCreatePolicy}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors duration-200 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Create Policy
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-dim mb-1">Total</p>
            <p className="font-mono text-2xl font-bold text-foreground">
              {stats.total}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-dim mb-1">Active</p>
            <p className="font-mono text-2xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-dim mb-1">Draft</p>
            <p className="font-mono text-2xl font-bold text-yellow-400">
              {stats.draft}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-dim mb-1">Disabled</p>
            <p className="font-mono text-2xl font-bold text-dim">
              {stats.disabled}
            </p>
          </div>
        </div>

        {/* AI Proposals Section */}
        {proposals.length > 0 && showProposals && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-accent"
                >
                  <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
                </svg>
                <h2 className="font-mono text-base font-semibold text-foreground">
                  Suggested Policies
                </h2>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {proposals.length} new
                </span>
              </div>
              <button
                onClick={() => setShowProposals(false)}
                className="text-xs text-dim hover:text-foreground transition-colors duration-200 cursor-pointer"
              >
                Hide suggestions
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {proposals.map((proposal) => (
                <PolicyProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAccept={handleAcceptProposal}
                  onDismiss={handleDismissProposal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search policies..."
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200 cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors duration-200 cursor-pointer"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>

        {/* Policies Grid */}
        {filteredPolicies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
            {searchQuery || filter !== "all" ? (
              <>
                <p className="text-sm text-muted mb-1">No policies found</p>
                <p className="text-xs text-dim">
                  Try adjusting your search or filters
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted mb-1">No policies yet</p>
                <p className="text-xs text-dim">
                  Create your first policy to get started
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredPolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={handleEditPolicy}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}

        {/* Editor Modal */}
        <PolicyEditor
          policy={editingPolicy}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSavePolicy}
        />
      </main>
    </div>
  );
}
