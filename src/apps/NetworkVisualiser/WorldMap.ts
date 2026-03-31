import type { IPNode, IPEdge } from './types';
import { getCountryColour, EDGE_COLOURS } from './colours';

// Natural Earth simplified GeoJSON — fetch from CDN
const WORLD_GEOJSON = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export async function renderWorldMap(
  svg: SVGSVGElement,
  nodes: IPNode[],
  edges: IPEdge[],
  d3: any,
  topojson: any,
  onNodeClick: (ip: string) => void
): Promise<void> {

  const W = svg.clientWidth, H = svg.clientHeight;
  const sel = d3.select(svg);
  sel.selectAll('*').remove();

  // Load world topology
  const world    = await fetch(WORLD_GEOJSON).then(r => r.json());
  const countries = topojson.feature(world, world.objects.countries);

  // Equirectangular projection — simple, recognisable
  const projection = d3.geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);

  const path = d3.geoPath().projection(projection);

  // Main zoom wrapper
  const mapGroup = sel.append('g').attr('class', 'map-wrapper');

  // Draw land — very dark fill, dim red border
  mapGroup.append('g').attr('class', 'land')
    .selectAll('path')
    .data(countries.features)
    .enter().append('path')
    .attr('d', path)
    .attr('fill',   '#0E0E14')
    .attr('stroke', 'rgba(192,0,26,0.15)')
    .attr('stroke-width', 0.5);

  // Graticule (grid lines)
  mapGroup.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill',   'none')
    .attr('stroke', 'rgba(192,0,26,0.06)')
    .attr('stroke-width', 0.5);

  const resolved = nodes.filter(n => n.resolved && n.lat !== null && n.lng !== null);

  // Draw arcs between same-ASN nodes
  const asnEdges = edges.filter(e => e.reason === 'same-asn');
  const nodeById = new Map(resolved.map(n => [n.ip, n]));

  mapGroup.append('g').attr('class', 'arcs')
    .selectAll('path')
    .data(asnEdges)
    .enter().append('path')
    .attr('d', (e: any) => {
      const a = nodeById.get(e.source), b = nodeById.get(e.target);
      if (!a || !b || a.lat === null || b.lat === null) return null;
      const [x1, y1] = projection([a.lng!, a.lat!]) ?? [0, 0];
      const [x2, y2] = projection([b.lng!, b.lat!]) ?? [0, 0];
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40;
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    })
    .attr('fill',   'none')
    .attr('stroke', EDGE_COLOURS['same-asn'])
    .attr('stroke-width', 1.5);

  // IP dots
  const dotGroup = mapGroup.append('g').attr('class', 'dots');

  resolved.forEach(n => {
    const [x, y] = projection([n.lng!, n.lat!]) ?? [0, 0];
    const g = dotGroup.append('g')
      .attr('transform', `translate(${x},${y})`)
      .attr('class', n.id === 'My Location' ? 'my-location-node' : 'node')
      .style('cursor', 'pointer')
      .on('click', () => onNodeClick(n.ip));

    // Outer glow ring
    g.append('circle')
      .attr('r', 8)
      .attr('fill', getCountryColour(n.countryCode))
      .attr('opacity', 0.2);

    // Inner dot
    g.append('circle')
      .attr('r', 4)
      .attr('fill', getCountryColour(n.countryCode))
      .attr('stroke', 'rgba(240,234,232,0.3)')
      .attr('stroke-width', 1);

    // Tooltip on hover
    g.on('mouseover', function(this: SVGGElement) {
      d3.select(this).select('circle:last-of-type').attr('r', 6);
    }).on('mouseout', function(this: SVGGElement) {
      d3.select(this).select('circle:last-of-type').attr('r', 4);
    });
  });

  // Zoom + pan
  sel.call(d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event: any) => {
      mapGroup.attr('transform', event.transform);
    }));
}
