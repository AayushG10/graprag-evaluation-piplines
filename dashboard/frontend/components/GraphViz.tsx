"use client";

import { useEffect, useRef } from "react";
import type { GraphNode, GraphEdge } from "@/app/page";

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Color + display config per node type
const TYPE_CONFIG: Record<string, { color: string; ring: string; bg: string; radius: number }> = {
  company:   { color: "#10b981", ring: "#10b981", bg: "#10b98122", radius: 24 },
  document:  { color: "#3b82f6", ring: "#3b82f6", bg: "#3b82f622", radius: 18 },
  risk:      { color: "#ef4444", ring: "#ef4444", bg: "#ef444422", radius: 16 },
  executive: { color: "#f97316", ring: "#f97316", bg: "#f9731622", radius: 16 },
  sector:    { color: "#a855f7", ring: "#a855f7", bg: "#a855f722", radius: 20 },
};

const TYPE_ICON: Record<string, string> = {
  company:   "🏢",
  document:  "📄",
  risk:      "⚠",
  executive: "👤",
  sector:    "🏭",
};

interface Props {
  data: GraphData;
  animate?: boolean;
}

export default function GraphViz({ data, animate = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    import("d3").then((d3) => {
      if (cancelled || !svgRef.current) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const W = svgRef.current.clientWidth  || 560;
      const H = svgRef.current.clientHeight || 300;

      // ── Defs: glow filter ────────────────────────────────────────────────
      const defs = svg.append("defs");

      const filter = defs.append("filter").attr("id", "glow-filter");
      filter.append("feGaussianBlur")
        .attr("stdDeviation", "4").attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      // Arrow marker for edges
      defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -4 8 8")
        .attr("refX", 8).attr("refY", 0)
        .attr("markerWidth", 5).attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-4L8,0L0,4")
        .attr("fill", "#334155");

      // ── Zoom/pan ──────────────────────────────────────────────────────────
      const g = svg.append("g");
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on("zoom", (e) => g.attr("transform", e.transform));
      svg.call(zoom);

      // ── Simulation ────────────────────────────────────────────────────────
      type SimNode = GraphNode & d3.SimulationNodeDatum;
      const simNodes: SimNode[] = data.nodes.map((n) => ({
        ...n,
        x: W / 2 + (Math.random() - 0.5) * 80,
        y: H / 2 + (Math.random() - 0.5) * 80,
      }));
      const nodeById = Object.fromEntries(simNodes.map((n) => [n.id, n]));

      type SimLink = d3.SimulationLinkDatum<SimNode> & { label: string; hop: number };
      const simLinks: SimLink[] = data.edges
        .filter((e) => nodeById[e.source] && nodeById[e.target])
        .map((e) => ({
          source: nodeById[e.source],
          target: nodeById[e.target],
          label: e.label,
          hop: e.hop,
        }));

      const sim = d3.forceSimulation(simNodes)
        .force("link", d3.forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id).distance(90).strength(0.7))
        .force("charge", d3.forceManyBody().strength(-220))
        .force("center", d3.forceCenter(W / 2, H / 2))
        .force("collision", d3.forceCollide<SimNode>()
          .radius((d) => (TYPE_CONFIG[d.type]?.radius ?? 16) + 10));

      // ── Draw edges ────────────────────────────────────────────────────────
      const linkG = g.append("g").attr("class", "links");

      const linkSel = linkG
        .selectAll<SVGGElement, SimLink>("g")
        .data(simLinks)
        .join("g")
        .attr("opacity", 0);

      linkSel.append("line")
        .attr("stroke", "#334155")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3")
        .attr("marker-end", "url(#arrowhead)");

      linkSel.append("text")
        .text((d) => d.label.replace(/_/g, " "))
        .attr("text-anchor", "middle")
        .attr("font-size", "7px")
        .attr("font-family", "monospace")
        .attr("fill", "#475569")
        .attr("dy", -5);

      // ── Draw nodes ────────────────────────────────────────────────────────
      const nodeG = g.append("g").attr("class", "nodes");

      const drag = d3.drag<SVGGElement, SimNode>()
        .on("start", (e, d) => {
          if (!e.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => {
          if (!e.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        });

      const nodeSel = nodeG
        .selectAll<SVGGElement, SimNode>("g")
        .data(simNodes)
        .join("g")
        .attr("opacity", 0)
        .attr("cursor", "grab")
        .call(drag);

      // Outer glow ring (shown on reveal)
      nodeSel.append("circle")
        .attr("class", "glow-ring")
        .attr("r", (d) => (TYPE_CONFIG[d.type]?.radius ?? 16) + 6)
        .attr("fill", "none")
        .attr("stroke", (d) => TYPE_CONFIG[d.type]?.color ?? "#64748b")
        .attr("stroke-width", 1)
        .attr("opacity", 0);

      // Main circle
      nodeSel.append("circle")
        .attr("r", (d) => TYPE_CONFIG[d.type]?.radius ?? 16)
        .attr("fill", (d) => TYPE_CONFIG[d.type]?.bg ?? "#1e293b")
        .attr("stroke", (d) => TYPE_CONFIG[d.type]?.color ?? "#64748b")
        .attr("stroke-width", 2);

      // Icon text
      nodeSel.append("text")
        .text((d) => TYPE_ICON[d.type] ?? "●")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", (d) => d.type === "company" ? "13px" : "10px")
        .attr("dy", "-0.5em");

      // Label below icon
      nodeSel.append("text")
        .text((d) => {
          const max = d.type === "company" ? 8 : 10;
          return d.label.length > max ? d.label.slice(0, max - 1) + "…" : d.label;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "7px")
        .attr("font-weight", "700")
        .attr("fill", (d) => TYPE_CONFIG[d.type]?.color ?? "#94a3b8")
        .attr("dy", "0.9em");

      // Type badge below node
      nodeSel.append("text")
        .text((d) => d.type.toUpperCase())
        .attr("text-anchor", "middle")
        .attr("y", (d) => (TYPE_CONFIG[d.type]?.radius ?? 16) + 12)
        .attr("font-size", "6px")
        .attr("font-weight", "800")
        .attr("letter-spacing", "0.08em")
        .attr("fill", "#475569");

      // ── Tick ──────────────────────────────────────────────────────────────
      sim.on("tick", () => {
        linkSel.select("line")
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = TYPE_CONFIG[(d.target as SimNode).type]?.radius ?? 16;
            return d.target.x - (dx / dist) * (r + 8);
          })
          .attr("y2", (d: any) => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = TYPE_CONFIG[(d.target as SimNode).type]?.radius ?? 16;
            return d.target.y - (dy / dist) * (r + 8);
          });

        linkSel.select("text")
          .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
          .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

        nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

      // ── Hop-by-hop animated reveal ────────────────────────────────────────
      const maxHop = Math.max(...data.nodes.map((n) => n.hop), 0);

      for (let hop = 0; hop <= maxHop; hop++) {
        const delay = animate ? hop * 900 : 0;

        // Reveal nodes
        timers.push(setTimeout(() => {
          if (cancelled) return;

          nodeSel.filter((d) => d.hop === hop)
            .transition().duration(500)
            .attr("opacity", 1);

          // Glow burst on reveal
          nodeSel.filter((d) => d.hop === hop)
            .select(".glow-ring")
            .attr("opacity", 0.8)
            .transition().duration(700)
            .attr("opacity", 0)
            .attr("r", (d) => (TYPE_CONFIG[d.type]?.radius ?? 16) + 18);

          // Main circle pulse
          nodeSel.filter((d) => d.hop === hop)
            .select("circle:not(.glow-ring)")
            .attr("filter", "url(#glow-filter)")
            .transition().delay(600).duration(500)
            .attr("filter", "none");

          // Reveal edges for this hop
          linkSel.filter((d) => d.hop === hop)
            .transition().duration(500)
            .attr("opacity", 1);
        }, delay));
      }
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [data, animate]);

  const maxHop = data.nodes.length ? Math.max(...data.nodes.map((n) => n.hop)) : 0;
  const presentTypes = [...new Set(data.nodes.map((n) => n.type))];

  return (
    <div className="rounded-xl bg-slate-950/70 border border-slate-800/60 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-400">
            GRAPH TRAVERSAL
          </span>
          <span className="text-[9px] text-slate-600 font-mono">
            {data.nodes.length} nodes · {data.edges.length} edges · {maxHop + 1} hop{maxHop !== 0 ? "s" : ""}
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3">
          {presentTypes.map((type) => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TYPE_CONFIG[type]?.color }}
              />
              <span className="text-[8px] text-slate-500 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* D3 canvas */}
      <svg
        ref={svgRef}
        className="w-full"
        style={{ height: "300px", display: "block" }}
      />

      {/* Hop timeline */}
      <div className="flex items-center gap-0 px-4 py-2.5 border-t border-slate-800/50 bg-slate-900/30 overflow-x-auto">
        {Array.from({ length: maxHop + 1 }, (_, i) => i).map((hop) => {
          const hopNodes = data.nodes.filter((n) => n.hop === hop);
          return (
            <div key={hop} className="flex items-center gap-0 shrink-0">
              <div className="flex flex-col items-center gap-1 px-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                  style={{
                    borderColor: hop === 0 ? "#10b981" : "#334155",
                    color: hop === 0 ? "#10b981" : "#64748b",
                    backgroundColor: hop === 0 ? "#10b98118" : "transparent",
                  }}
                >
                  {hop}
                </div>
                <span className="text-[8px] text-slate-600 whitespace-nowrap">
                  {hopNodes.map((n) => n.label).slice(0, 2).join(", ")}
                  {hopNodes.length > 2 ? ` +${hopNodes.length - 2}` : ""}
                </span>
              </div>
              {hop < maxHop && (
                <div className="w-6 h-px bg-slate-700 mb-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
