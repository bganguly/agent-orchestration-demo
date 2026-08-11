"use client";

import { memo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Handle,
  Position,
  MarkerType,
  Background,
  Controls,
  Panel,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type NodeStatus = "running" | "done";

export interface FlowNode {
  id: string;
  label: string;
  layer: number;
  parent: string | null;
  status: NodeStatus;
  detail?: string;
  seq: number;
}

// ── Phase config (light/dark friendly) ─────────────────────────
const PHASE: Record<number, { name: string; desc: string; color: string; dimColor: string; bg: string }> = {
  0: { name: "Planner",      desc: "Classifies query complexity and selects specialist researchers",       color: "#818cf8", dimColor: "#818cf840", bg: "#818cf810" },
  1: { name: "Researcher",   desc: "Parallel Wikipedia + web search in a specialist domain",               color: "#60a5fa", dimColor: "#60a5fa40", bg: "#60a5fa10" },
  2: { name: "Synthesizer",  desc: "Distills research from multiple specialists into a domain summary",     color: "#2dd4bf", dimColor: "#2dd4bf40", bg: "#2dd4bf10" },
  3: { name: "Fact-checker", desc: "Cross-validates claims and flags contradictions across syntheses",      color: "#fb923c", dimColor: "#fb923c40", bg: "#fb923c10" },
  4: { name: "Writer",       desc: "Generates the final structured research report",                       color: "#4ade80", dimColor: "#4ade8040", bg: "#4ade8010" },
};

// ── Layout ──────────────────────────────────────────────────────
const LAYER_Y: Record<number, number> = { 0: 40, 1: 200, 2: 360, 3: 480, 4: 600 };
const NODE_W = 148;
const NODE_H = 58;
const CANVAS_W = 1600;
const MAX_PER_LAYER: Record<number, number> = { 0: 1, 1: 10, 2: 4, 3: 1, 4: 1 };

function nodeX(layer: number, idx: number): number {
  const slots = MAX_PER_LAYER[layer] ?? 4;
  const step = CANVAS_W / (slots + 1);
  return step * (idx + 1) - NODE_W / 2;
}

// ── Node component ──────────────────────────────────────────────
const AgentNode = memo(function AgentNode({
  data,
}: {
  data: { label: string; status: NodeStatus; detail?: string; seq: number; layer: number };
}) {
  const [hover, setHover] = useState(false);
  const { zoom } = useViewport();
  const isRunning = data.status === "running";
  const isDone    = data.status === "done";
  const phase = PHASE[data.layer] ?? PHASE[0];

  // Tooltip must appear at screen-level size regardless of canvas zoom
  const tooltipScale = 1 / zoom;

  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Handle type="target" position={Position.Top}    style={{ background: phase.color, width: 6, height: 6 }} />

      {/* ── Agent sequence badge ── */}
      <div
        style={{
          position: "absolute", top: -8, right: -8, zIndex: 10,
          background: isDone ? phase.color : isRunning ? phase.color : "var(--border)",
          color: "#fff",
          fontSize: 8, fontFamily: "monospace", fontWeight: 700,
          borderRadius: 10, padding: "1px 5px", lineHeight: "14px",
          transition: "background 0.3s",
        }}
      >
        #{data.seq}
      </div>

      {/* ── Card ── */}
      <div
        style={{
          width: NODE_W,
          minHeight: NODE_H,
          borderRadius: 8,
          border: `1.5px solid ${isDone ? phase.color : isRunning ? phase.color : "var(--border)"}`,
          borderLeft: `3px solid ${phase.color}`,
          background: isDone ? phase.bg : isRunning ? phase.bg : "var(--surface)",
          padding: "8px 10px 8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          boxShadow: isRunning ? `0 0 0 3px ${phase.dimColor}` : undefined,
          transition: "all 0.25s ease",
          animation: isRunning ? "nodePulse 1.4s ease-in-out infinite" : undefined,
          cursor: "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: phase.color, lineHeight: 1, flexShrink: 0 }}>
            {isDone ? "✓" : isRunning ? "⟳" : "○"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: isDone || isRunning ? phase.color : "var(--text-2)", lineHeight: 1.3 }}>
            {data.label}
          </span>
        </div>
        {data.detail && isDone && (
          <span style={{ fontSize: 9, color: "var(--text-2)", paddingLeft: 17, lineHeight: 1.4, opacity: 0.9 }}>
            {data.detail}
          </span>
        )}
      </div>

      {/* ── Hover tooltip (zoom-invariant) ── */}
      {hover && (
        <div
          style={{
            position: "absolute",
            bottom: `calc(100% + 10px)`,
            left: "50%",
            transform: `translateX(-50%) scale(${tooltipScale})`,
            transformOrigin: "bottom center",
            background: "var(--surface)",
            border: `1.5px solid ${phase.color}`,
            borderRadius: 10,
            padding: "12px 16px",
            width: 230,
            zIndex: 9999,
            boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
            pointerEvents: "none",
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: phase.color }}>
              Agent #{data.seq} — {phase.name}
            </span>
          </div>
          {/* role description */}
          <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.5, marginBottom: data.detail ? 8 : 0 }}>
            {phase.desc}
          </div>
          {/* result detail */}
          {data.detail && (
            <div style={{ borderTop: `1px solid ${phase.color}30`, paddingTop: 8, marginTop: 2 }}>
              <div style={{ fontSize: 9.5, fontFamily: "monospace", color: "var(--text-2)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Result
              </div>
              <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.5 }}>
                {data.detail}
              </div>
            </div>
          )}
          {!data.detail && isRunning && (
            <div style={{ fontSize: 11, color: "var(--text-2)", fontStyle: "italic", marginTop: 4 }}>
              Working…
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: phase.color, width: 6, height: 6 }} />
    </div>
  );
});

const nodeTypes = { agentNode: AgentNode };

// ── Edge builder ─────────────────────────────────────────────────
function buildEdges(flowNodes: FlowNode[]): Edge[] {
  const edges: Edge[] = [];
  const byLayer: Record<number, FlowNode[]> = {};
  flowNodes.forEach((n) => { (byLayer[n.layer] ??= []).push(n); });

  const marker = (color: string) => ({
    type: MarkerType.ArrowClosed, width: 9, height: 9, color,
  });

  // plan → each researcher (fan-out)
  byLayer[1]?.forEach((n) => {
    edges.push({
      id: `e-plan-${n.id}`, source: "plan", target: n.id,
      animated: n.status === "running",
      style: { stroke: PHASE[1].color, strokeWidth: 1.5, opacity: 0.7 },
      markerEnd: marker(PHASE[1].color),
    });
  });

  // researchers → synthesizers (M:N convergence mesh — faint)
  const hasSynth = !!byLayer[2]?.length;
  if (hasSynth) {
    byLayer[1]?.forEach((rn) => {
      byLayer[2]!.forEach((sn) => {
        edges.push({
          id: `e-${rn.id}-${sn.id}`, source: rn.id, target: sn.id,
          animated: sn.status === "running",
          style: { stroke: PHASE[2].color, strokeWidth: 0.8, opacity: 0.22 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 7, height: 7, color: PHASE[2].color },
        });
      });
    });
  }

  // simple path: researchers → write (no synthesizers, no fact-check)
  const writeNode = flowNodes.find((n) => n.id === "write");
  const hasFc = flowNodes.some((n) => n.id === "fact_check");
  if (writeNode && writeNode.layer === 2 && !hasFc && !hasSynth) {
    byLayer[1]?.forEach((n) => {
      edges.push({
        id: `e-${n.id}-write`, source: n.id, target: "write",
        animated: writeNode.status === "running",
        style: { stroke: PHASE[4].color, strokeWidth: 1.5, opacity: 0.7 },
        markerEnd: marker(PHASE[4].color),
      });
    });
  }

  // synthesizers → fact_check (fan-in)
  if (hasFc) {
    byLayer[2]?.forEach((n) => {
      edges.push({
        id: `e-${n.id}-fc`, source: n.id, target: "fact_check",
        animated: n.status === "running",
        style: { stroke: PHASE[3].color, strokeWidth: 1.5, opacity: 0.7 },
        markerEnd: marker(PHASE[3].color),
      });
    });
  }

  // fact_check → write
  if (hasFc && writeNode) {
    edges.push({
      id: "e-fc-write", source: "fact_check", target: "write",
      animated: writeNode.status === "running",
      style: { stroke: PHASE[4].color, strokeWidth: 1.5, opacity: 0.7 },
      markerEnd: marker(PHASE[4].color),
    });
  }

  return edges;
}

// ── Phase legend ─────────────────────────────────────────────────
function PhaseLegend({ flowNodes }: { flowNodes: FlowNode[] }) {
  const layerCounts: Record<number, { total: number; done: number }> = {};
  flowNodes.forEach((n) => {
    if (!layerCounts[n.layer]) layerCounts[n.layer] = { total: 0, done: 0 };
    layerCounts[n.layer].total += 1;
    if (n.status === "done") layerCounts[n.layer].done += 1;
  });

  const presentLayers = [0, 1, 2, 3, 4].filter((l) => layerCounts[l]);
  if (presentLayers.length === 0) return null;

  return (
    <Panel position="top-left">
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          minWidth: 150,
          fontSize: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--text-2)", marginBottom: 2, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>
          Pipeline phases
        </div>
        {presentLayers.map((layer) => {
          const p = PHASE[layer];
          const c = layerCounts[layer];
          const allDone = c.done === c.total;
          return (
            <div key={layer} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: allDone ? p.color : p.bg, border: `1.5px solid ${p.color}`, flexShrink: 0 }} />
              <span style={{ color: allDone ? p.color : "var(--text-2)", fontWeight: allDone ? 600 : 400 }}>
                {p.name}
                {c.total > 1 && (
                  <span style={{ marginLeft: 4, color: p.color, fontFamily: "monospace" }}>
                    ×{c.total}
                    {c.total > 1 && (
                      <span style={{ opacity: 0.6, fontSize: 9 }}> parallel</span>
                    )}
                  </span>
                )}
              </span>
              <span style={{ marginLeft: "auto", fontFamily: "monospace", color: allDone ? p.color : "var(--text-2)", fontSize: 9 }}>
                {c.done}/{c.total}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Main export ─────────────────────────────────────────────────
export default function AgentGraph({ flowNodes }: { flowNodes: FlowNode[] }) {
  const layerCounters: Record<number, number> = {};
  const rfNodes: Node[] = flowNodes.map((fn) => {
    const idx = layerCounters[fn.layer] ?? 0;
    layerCounters[fn.layer] = idx + 1;
    return {
      id: fn.id,
      type: "agentNode",
      position: { x: nodeX(fn.layer, idx), y: LAYER_Y[fn.layer] ?? fn.layer * 160 },
      data: { label: fn.label, status: fn.status, detail: fn.detail, seq: fn.seq, layer: fn.layer },
    };
  });

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={rfNodes}
        edges={buildEdges(flowNodes)}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: -214, y: 0, zoom: 0.9 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={28} size={1} />
        <Controls showInteractive={false} />
        <PhaseLegend flowNodes={flowNodes} />
      </ReactFlow>
    </div>
  );
}
