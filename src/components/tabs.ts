// Lightweight tab switcher. Tab id is mirrored in the URL hash so refresh
// keeps the active tab.

export interface TabDef {
  id: string;
  label: string;
  badge?: () => string | null;
  render: (host: HTMLElement) => void | Promise<void>;
}

export interface TabsHandle {
  setActive(id: string): void;
  refreshBadges(): void;
}

export function renderTabs(
  container: HTMLElement,
  tabs: TabDef[],
  initialId?: string
): TabsHandle {
  container.innerHTML = `
    <div class="tabs" role="tablist"></div>
    <div class="mt-6" id="tab-panel"></div>
  `;
  const tabBar = container.querySelector('.tabs') as HTMLElement;
  const panel = container.querySelector('#tab-panel') as HTMLElement;

  const buttons: HTMLButtonElement[] = [];
  for (const t of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.dataset.tabId = t.id;
    btn.setAttribute('role', 'tab');
    btn.innerHTML = renderLabel(t);
    btn.addEventListener('click', () => activate(t.id));
    tabBar.appendChild(btn);
    buttons.push(btn);
  }

  function renderLabel(t: TabDef): string {
    const badge = t.badge?.();
    return badge != null
      ? `${t.label} <span class="ml-1 text-xs text-ink-500">(${badge})</span>`
      : t.label;
  }

  function activate(id: string) {
    const t = tabs.find((x) => x.id === id) ?? tabs[0];
    for (const b of buttons) {
      const isActive = b.dataset.tabId === t.id;
      b.classList.toggle('tab-active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    }
    panel.innerHTML = '';
    history.replaceState(null, '', `#${t.id}`);
    void t.render(panel);
  }

  function refreshBadges() {
    for (const b of buttons) {
      const t = tabs.find((x) => x.id === b.dataset.tabId);
      if (t) b.innerHTML = renderLabel(t);
    }
  }

  const fromHash = location.hash.replace('#', '');
  const start =
    tabs.find((t) => t.id === fromHash)?.id ??
    initialId ??
    tabs[0].id;
  activate(start);

  return {
    setActive: (id: string) => activate(id),
    refreshBadges,
  };
}
