import {
  Chart,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
} from 'chart.js';
import type { Application, CvVersion } from '../types';
import {
  countBy,
  cvEffectiveness,
  prettySource,
} from '../utils/stats';

Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  BarController
);

const palette = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#7a8298',
];

const baseTextColor = '#a9b0c2';

function paletteFor(n: number): string[] {
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

function makeCanvas(parent: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  return canvas;
}

function chartCard(title: string, subtitle?: string): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="flex items-baseline justify-between mb-3">
      <h3 class="text-sm font-semibold text-ink-100 uppercase tracking-wider">${title}</h3>
      ${subtitle ? `<span class="text-xs text-ink-400">${subtitle}</span>` : ''}
    </div>
    <div class="chart-wrap" style="position: relative; height: 220px;"></div>
  `;
  return card;
}

export function renderBreakdownCharts(
  container: HTMLElement,
  apps: Application[],
  cvs: CvVersion[]
): void {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4';
  container.appendChild(grid);

  // Sector
  const sectorCard = chartCard('By sector');
  grid.appendChild(sectorCard);
  const sectorMap = countBy(apps, (a) => a.sector);
  doughnut(sectorCard.querySelector('.chart-wrap') as HTMLElement, sectorMap);

  // Source
  const sourceCard = chartCard('By source');
  grid.appendChild(sourceCard);
  const sourceMap = countBy(apps, (a) => prettySource(a.source));
  doughnut(sourceCard.querySelector('.chart-wrap') as HTMLElement, sourceMap);

  // Company stage
  const stageCard = chartCard('By company stage');
  grid.appendChild(stageCard);
  const stageMap = countBy(apps, (a) => a.company_stage);
  doughnut(stageCard.querySelector('.chart-wrap') as HTMLElement, stageMap);

  // CV effectiveness — grouped bar (interview rate, offer rate per CV)
  const cvCard = chartCard('CV effectiveness', 'interview / offer rate by CV version');
  grid.appendChild(cvCard);
  cvBars(cvCard.querySelector('.chart-wrap') as HTMLElement, apps, cvs);
}

function doughnut(parent: HTMLElement, data: Map<string, number>) {
  const labels = [...data.keys()];
  const values = [...data.values()];
  const canvas = makeCanvas(parent);
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: paletteFor(labels.length),
          borderColor: '#171b2a',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: baseTextColor, boxWidth: 10, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed} app${ctx.parsed === 1 ? '' : 's'}`,
          },
        },
      },
      cutout: '60%',
    },
  });
}

function cvBars(parent: HTMLElement, apps: Application[], cvs: CvVersion[]) {
  const data = cvEffectiveness(apps);
  const cvLabel = (id: string) =>
    cvs.find((c) => c.id === id)?.label ?? id;
  const labels = data.map((d) => cvLabel(d.cv));
  const interview = data.map((d) => +(d.interviewRate * 100).toFixed(1));
  const offer = data.map((d) => +(d.offerRate * 100).toFixed(1));
  const totals = data.map((d) => d.applications);
  const canvas = makeCanvas(parent);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Interview %',
          data: interview,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
        },
        {
          label: 'Offer %',
          data: offer,
          backgroundColor: '#10b981',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: baseTextColor, font: { size: 10 } }, grid: { display: false } },
        y: {
          ticks: { color: baseTextColor, callback: (v) => `${v}%` },
          grid: { color: 'rgba(255,255,255,0.05)' },
          max: 100,
        },
      },
      plugins: {
        legend: { labels: { color: baseTextColor, boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) =>
              `n = ${totals[ctx.dataIndex]} applications`,
          },
        },
      },
    },
  });
}
