import type { IPNode, IPEdge } from './types';
import { getCountryColour, EDGE_COLOURS, EDGE_WIDTHS } from './colours';

export function renderForceGraph(
  svg: SVGSVGElement,
  nodes: IPNode[],
  edges: IPEdge[],
  d3: any,
  onNodeClick: (ip: string) => void
): () => void {   // Returns a cleanup function

  const W = svg.clientWidth, H = svg.clientHeight;
  const sel = d3.select(svg);
  sel.selectAll('*').remove();

  // Defs — arrowhead marker in Aberdeen red
  const defs = sel.append('defs');
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'rgba(192,0,26,0.6)');

  // Groups — edges below nodes
  const edgeGroup = sel.append('g').attr('class', 'edges');
  const nodeGroup = sel.append('g').attr('class', 'nodes');

  // D3 simulation nodes need x/y mutated in place
  const simNodes = nodes.map(n => ({ ...n, x: W/2 + (Math.random()-0.5)*200, y: H/2 + (Math.random()-0.5)*200 }));
  const simEdges = edges.map(e => ({ ...e }));

  const nodeById = new Map(simNodes.map(n => [n.ip, n]));

  const simulation = d3.forceSimulation(simNodes)
    .force('link', d3.forceLink(simEdges)
      .id((d: any) => d.ip)
      .distance((e: any) => e.reason === 'same-asn' ? 80 : e.reason === 'same-subnet' ? 120 : 180)
      .strength((e: any) => e.reason === 'same-asn' ? 0.8 : e.reason === 'same-subnet' ? 0.5 : 0.2))
    .force('charge', d3.forceManyBody().strength(-160))
    .force('center', d3.forceCenter(W/2, H/2))
    .force('collision', d3.forceCollide().radius(28));

  // Edges
  const edgeSel = edgeGroup.selectAll('line')
    .data(simEdges).enter().append('line')
    .attr('stroke',       (e: any) => EDGE_COLOURS[e.reason])
    .attr('stroke-width', (e: any) => EDGE_WIDTHS[e.reason]);

  // Node groups
  const nodeSel = nodeGroup.selectAll('g')
    .data(simNodes).enter().append('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
      .on('end',   (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
    .on('click', (_: any, d: any) => onNodeClick(d.ip));

  // Node circle — radius scales with connection degree
  nodeSel.append('circle')
    .attr('r',    (d: any) => 8 + Math.min(d.connections * 2, 14))
    .attr('fill', (d: any) => d.resolved ? getCountryColour(d.countryCode) : '#4A4248')
    .attr('stroke',       (d: any) => d.isPrivate ? '#FFA500' : 'rgba(240,234,232,0.15)')
    .attr('stroke-width', 1.5);

  // Unresolved spinner ring
  nodeSel.filter((d: any) => !d.resolved)
    .append('circle')
    .attr('r', 14)
    .attr('fill', 'none')
    .attr('stroke', 'var(--red-mid)')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4 4')
    .attr('class', 'spinner-ring');

  // IP label
  nodeSel.append('text')
    .text((d: any) => d.ip)
    .attr('dy', (d: any) => -(10 + Math.min(d.connections * 2, 14)))
    .attr('text-anchor', 'middle')
    .attr('font-family', "'Share Tech Mono', monospace")
    .attr('font-size', '10px')
    .attr('fill', 'var(--text-2)')
    .attr('pointer-events', 'none');

  // Tick
  simulation.on('tick', () => {
    edgeSel
      .attr('x1', (e: any) => e.source.x)
      .attr('y1', (e: any) => e.source.y)
      .attr('x2', (e: any) => e.target.x)
      .attr('y2', (e: any) => e.target.y);
    nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  });

  // Zoom + pan
  sel.call(d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event: any) => {
      edgeGroup.attr('transform', event.transform);
      nodeGroup.attr('transform', event.transform);
    }));

  return () => simulation.stop();
}
