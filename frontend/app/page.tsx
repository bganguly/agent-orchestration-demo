"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import type { FlowNode } from "@/components/AgentGraph";
import BackToPortfolio from "@/components/BackToPortfolio";

const AgentGraph = dynamic(() => import("@/components/AgentGraph"), { ssr: false });

type Provider = "anthropic" | "openai";

const PROVIDER_LABELS: Record<Provider, { short: string; full: string }> = {
  anthropic: { short: "Claude", full: "Anthropic" },
  openai:    { short: "GPT",    full: "OpenAI" },
};

const EXAMPLE_QUERIES = [
  { label: "AI in drug discovery", query: "What is the impact of artificial intelligence on drug discovery and pharmaceutical development?" },
  { label: "Climate & food security", query: "How does climate change affect global food security and agricultural systems worldwide?" },
  { label: "EV industry disruption", query: "Analyze the rise of electric vehicles and their impact on the automotive industry and global energy sector." },
];

const SIMPLE_QUERIES = [
  { label: "mRNA vaccines", query: "How does mRNA vaccine technology work?" },
  { label: "History of the internet", query: "What is the history of the internet?" },
];

export default function Home() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [query, setQuery] = useState("");
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  function reset() {
    setFlowNodes([]);
    setAnswer("");
    seqRef.current = 0;
  }

  function upsertNode(partial: Omit<Partial<FlowNode>, "seq"> & { id: string }) {
    setFlowNodes((prev) => {
      const existing = prev.find((n) => n.id === partial.id);
      if (existing) {
        return prev.map((n) => (n.id === partial.id ? { ...n, ...partial } : n));
      }
      seqRef.current += 1;
      const seq = seqRef.current;
      return [
        ...prev,
        {
          label: partial.label ?? partial.id,
          layer: partial.layer ?? 0,
          parent: partial.parent ?? null,
          status: partial.status ?? "running",
          seq,
          ...partial,
        } as FlowNode,
      ];
    });
  }

  async function runAgent(q: string) {
    if (running) return;
    reset();
    setRunning(true);
    abortRef.current = new AbortController();
    let gotOutput = false;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, provider }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const ev = JSON.parse(payload);

            if (ev.type === "step_start") {
              upsertNode({ id: ev.node, label: ev.label, layer: ev.layer, parent: ev.parent, status: "running" });
            } else if (ev.type === "step_done") {
              upsertNode({ id: ev.node, label: ev.label, layer: ev.layer, parent: ev.parent, status: "done", detail: ev.detail });
            } else if (ev.type === "answer") {
              gotOutput = true;
              setAnswer(ev.text);
            } else if (ev.type === "error") {
              gotOutput = true;
              setAnswer(`Error: ${ev.text}`);
            }
          } catch {
            // malformed line
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        gotOutput = true;
        setAnswer("Error: could not reach the agent backend.");
      }
    } finally {
      if (!gotOutput && !abortRef.current?.signal.aborted) {
        setAnswer("Error: pipeline returned no output — check API key configuration.");
      }
      setRunning(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) runAgent(query.trim());
  }

  const doneCount = flowNodes.filter((n) => n.status === "done").length;
  const totalCount = flowNodes.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <BackToPortfolio />
      {/* Header */}
      <header style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
            Agent Orchestration Demo
          </span>
          <h1 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            LangGraph · Multi-agent research · MCP server
          </h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span className="hidden sm:inline text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            Provider
          </span>
          {(["anthropic", "openai"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className="px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-mono transition-colors"
              style={{
                background: provider === p ? "var(--accent)" : "var(--bg)",
                color: provider === p ? "#fff" : "var(--text-2)",
                border: `1px solid ${provider === p ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              <span className="sm:hidden">{PROVIDER_LABELS[p].short}</span>
              <span className="hidden sm:inline">{PROVIDER_LABELS[p].full}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Input bar */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a research question — complex queries activate up to 17 agents…"
            style={{ flex: 1, borderRadius: 6, padding: "7px 12px", fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
          />
          <button
            type="submit"
            disabled={running || !query.trim()}
            style={{ padding: "7px 18px", borderRadius: 6, fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", cursor: running || !query.trim() ? "not-allowed" : "pointer", opacity: running || !query.trim() ? 0.5 : 1 }}
          >
            {running ? "Running…" : "Run"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--text-2)", marginRight: 2 }}>complex →</span>
          {EXAMPLE_QUERIES.map((ex) => (
            <button key={ex.label} onClick={() => { setQuery(ex.query); runAgent(ex.query); }}
              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-2)", background: "transparent", cursor: "pointer" }}>
              {ex.label}
            </button>
          ))}
          <span style={{ fontSize: 10, color: "var(--text-2)", marginLeft: 6, marginRight: 2 }}>simple →</span>
          {SIMPLE_QUERIES.map((ex) => (
            <button key={ex.label} onClick={() => { setQuery(ex.query); runAgent(ex.query); }}
              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-2)", background: "transparent", cursor: "pointer" }}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main — graph left, answer right */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* DAG canvas */}
        <div style={{ flex: "0 0 62%", position: "relative", borderRight: "1px solid var(--border)" }}>
          {totalCount > 0 && (
            <div style={{ position: "absolute", top: 10, left: 12, zIndex: 10, fontSize: 10, fontFamily: "monospace", color: "var(--text-2)", background: "var(--surface)", padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border)" }}>
              {running ? `${doneCount} / ${totalCount} agents done` : `${totalCount} agents · complete`}
            </div>
          )}

          {flowNodes.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--text-2)" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="10" r="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="10" cy="32" r="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="24" cy="32" r="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="38" cy="32" r="5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="24" y1="15" x2="10" y2="27" stroke="currentColor" strokeWidth="1.5" />
                <line x1="24" y1="15" x2="24" y2="27" stroke="currentColor" strokeWidth="1.5" />
                <line x1="24" y1="15" x2="38" y2="27" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p style={{ fontSize: 12, margin: 0 }}>Agent graph appears here as the pipeline runs</p>
              <p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>Complex queries spawn up to 17 nodes in parallel</p>
            </div>
          ) : (
            <AgentGraph flowNodes={flowNodes} />
          )}
        </div>

        {/* Answer panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {!answer && !running && flowNodes.length === 0 && (
            <div style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.7 }}>
              <p style={{ marginBottom: 12 }}>Select an example or type a question. The pipeline:</p>
              <ol style={{ paddingLeft: 18, fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong style={{ color: "var(--text)" }}>Planner</strong> — classifies query, selects 2–10 specialist researchers</li>
                <li><strong style={{ color: "var(--text)" }}>Researchers ×N</strong> — parallel Wikipedia + DuckDuckGo per domain</li>
                <li><strong style={{ color: "var(--text)" }}>Synthesizers ×4</strong> — clinical, business, policy, societal (complex only)</li>
                <li><strong style={{ color: "var(--text)" }}>Fact Check</strong> — validates key claims (complex only)</li>
                <li><strong style={{ color: "var(--text)" }}>Report Writer</strong> — final structured answer</li>
              </ol>
            </div>
          )}
          {running && !answer && (
            <p style={{ color: "var(--text-2)", fontSize: 13, animation: "pulse 1.5s ease-in-out infinite" }}>
              Agents working…
            </p>
          )}
          {answer && (
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "var(--text)", whiteSpace: "pre-wrap" }}>
              {answer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
