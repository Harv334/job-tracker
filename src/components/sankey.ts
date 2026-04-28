import * as d3 from 'd3';
import {
  sankey as d3sankey,
  sankeyLinkHorizontal,
  type SankeyGraph,
} from 'd3-sankey';
import type { Application } from '../types';
import { buildSankeyLinks } from '../utils/stats';

interface Node extends d3.SimulationNodeDatum {
  name: string;
}
interface Link {
  source: string | number | Node;
  target: string | number | Node;
  value: number;
}

const stageColor: Record<string, string> = {
  Applied: '#4f46e5',
  'Phone screen': '#7c3aed',
  'Hiring manager': '#9333ea',
  Technical: '#c026d3',
  Onsite: '#db2777',
  Offer: '#059669',
  Accepted: '#059669',
  Rejected: '#dc2626',
  Ghosted: '#7a8298',
  Withdrawn: '#d97706',
  'In progress': '#818cf8',
};

export function renderSankey(container: HTMLElement, apps: Application[]): void {
  container.innerHTML = '';
  const { nodes, links } = buildSankeyLinks(apps);

  if (links.length === 0) {
    container.innerHTML =
      '<p class="text-ink-500 text-sm">No stage transitions yet — add applications in the Spreadsheet tab to see the funnel.</p>';
    return;
  }

  const width = container.clientWidth || 900;
  const height = 380;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height);

  const sankey = d3sankey<Node, Link>()
    .nodeId((d) => d.name)
    .nodeWidth(14)
    .nodePadding(14)
    .extent([
      [10, 10],
      [width - 10, height - 10],
    ]);

  const graph: SankeyGraph<Node, Link> = sankey({
    nodes: nodes.map((n) => ({ ...n })),
    links: links.map((l) => ({ ...l })),
  });

  svg
    .append('g')
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('class', 'sankey-link')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => {
      const src = d.source as Node;
      return stageColor[src.name] ?? '#7a8298';
    })
    .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
    .append('title')
    .text((d) => {
      const s = d.source as Node;
      const t = d.target as Node;
      return `${s.name} -> ${t.name}: ${d.value}`;
    });

  const node = svg
    .append('g')
    .selectAll('g')
    .data(graph.nodes)
    .join('g')
    .attr('class', 'sankey-node');

  node
    .append('rect')
    .attr('x', (d) => d.x0 ?? 0)
    .attr('y', (d) => d.y0 ?? 0)
    .attr('height', (d) => (d.y1 ?? 0) - (d.y0 ?? 0))
    .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
    .attr('fill', (d) => stageColor[d.name] ?? '#7a8298')
    .attr('rx', 2)
    .append('title')
    .text((d) => `${d.name}\n${d.value ?? 0} apps`);

  node
    .append('text')
    .attr('x', (d) => ((d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6))
    .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => ((d.x0 ?? 0) < width / 2 ? 'start' : 'end'))
    .text((d) => `${d.name} (${d.value ?? 0})`);
}
