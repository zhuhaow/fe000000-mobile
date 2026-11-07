/* Presentation adapter. All game calculations, purchases and unlocks remain upstream. */
(() => {
  'use strict';
  if (!document.documentElement.classList.contains('modern-ui')) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const groupLabel = key => key[0].toUpperCase() + key.slice(1);
  const shortLabel = (key, name) => key === 'last-ten-runs' ? 'Recent runs' : name.replace(/^(Infinity|Eternity|Complexity|Finality) /, '');
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const write = (node, html) => { if (node.innerHTML !== String(html)) node.innerHTML = html; };
  const attribute = (node, key, value) => { if (node.getAttribute(key) !== String(value)) node.setAttribute(key, String(value)); };
  let main, primary, subnav, directory, resets, help, themeButton, ready = false;
  let currentTab = null, navSignature = '', directorySignature = '', buyMode = '1', theme = 'system';
  const labels = {}, scrollPositions = new Map(), horizontalPositions = new Map(), generators = new Map();
  const themeMedia = matchMedia('(prefers-color-scheme: dark)');
  try { theme = localStorage.getItem('fe000000-ui-theme') || 'system'; } catch (_) {}
  if (!['system', 'dark', 'light'].includes(theme)) theme = 'system';

  function setTheme(value, persist = true) {
    theme = value;
    const resolved = value === 'system' ? (themeMedia.matches ? 'dark' : 'light') : value;
    if (document.documentElement.dataset.theme !== resolved) document.documentElement.dataset.theme = resolved;
    if (player.options.theme.background !== groupLabel(resolved)) {
      player.options.theme.background = groupLabel(resolved);
      Colors.updateColors();
    }
    if (themeButton) {
      const icon = resolved === 'dark' ? '☀' : '☾';
      if (themeButton.textContent !== icon) themeButton.textContent = icon;
      attribute(themeButton, 'aria-label', resolved === 'dark' ? 'Use light theme' : 'Use dark theme');
    }
    $$('[data-ui-theme]').forEach(b => attribute(b, 'aria-pressed', b.dataset.uiTheme === value));
    if (persist) try { localStorage.setItem('fe000000-ui-theme', value); } catch (_) {}
  }

  function makeDialog(id, title) {
    const dialog = create('dialog', 'ui-dialog');
    dialog.id = id;
    const head = create('div', 'ui-dialog-head');
    const heading = create('h2', '', title);
    heading.id = id + '-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const close = create('button', '', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close ' + title.toLowerCase());
    close.addEventListener('click', () => dialog.close());
    head.append(heading, close);
    const body = create('div');
    body.id = id + '-body';
    dialog.append(head, body);
    document.body.append(dialog);
    dialog.addEventListener('click', e => { if (e.target === dialog && e.clientX && e.clientY) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    } });
    return dialog;
  }

  const visibleTabs = group => Tabs.tabGroupToTab[group].filter(key => Tabs.isTabVisibleRaw(key));
  const visibleGroups = () => Tabs.groups.filter(group => visibleTabs(group).length);
  function pageButton(key) {
    const button = create('button', '', shortLabel(key, labels[key] || groupLabel(key)));
    button.type = 'button';
    button.dataset.page = key;
    if (key === Tabs.currentTab()) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      if (directory.open) directory.close();
      Tabs.setTab(key);
    });
    return button;
  }

  function renderDirectory() {
    const groups = visibleGroups();
    const signature = JSON.stringify([groups.map(g => [g, visibleTabs(g)]), Tabs.currentTab()]);
    if (signature === directorySignature) return;
    directorySignature = signature;
    const body = $('#ui-pages-body');
    body.replaceChildren();
    for (const group of groups) {
      const section = create('section', 'ui-page-group');
      const grid = create('div', 'ui-page-grid');
      section.append(create('h3', '', groupLabel(group)), grid);
      grid.append(...visibleTabs(group).map(pageButton));
      body.append(section);
    }
    const oldFooter = $('.ui-directory-nav', directory);
    if (oldFooter) oldFooter.remove();
    const footer = primary.cloneNode(true);
    footer.classList.add('ui-directory-nav');
    $$('button', footer).forEach(button => {
      button.removeAttribute('aria-current');
      if (!button.dataset.group) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => {
        if (!button.dataset.group) return;
        directory.close();
        Tabs.setTabGroup(button.dataset.group);
      });
    });
    directory.append(footer);
  }

  function openPages() {
    renderDirectory();
    if (!directory.open) directory.showModal();
  }

  function renderNavigation() {
    const group = Tabs.tabToTabGroup[Tabs.currentTab()];
    const groups = visibleGroups();
    const tabs = visibleTabs(group);
    const signature = JSON.stringify([group, Tabs.currentTab(), groups, groups.map(visibleTabs)]);
    if (signature === navSignature) return;
    navSignature = signature;
    primary.replaceChildren();
    const gameGroups = groups.filter(g => g !== 'miscellaneous');
    const directGroups = gameGroups.length <= 4 ? gameGroups : [gameGroups[0], ...gameGroups.slice(-3)];
    for (const key of directGroups) {
      const button = create('button', '', groupLabel(key));
      button.type = 'button';
      button.dataset.group = key;
      if (key === group) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => Tabs.setTabGroup(key));
      primary.append(button);
    }
    const all = create('button', '', '▦ All');
    all.type = 'button';
    all.setAttribute('aria-label', 'All unlocked pages');
    if (group === 'miscellaneous' || !directGroups.includes(group)) all.setAttribute('aria-current', 'page');
    all.addEventListener('click', openPages);
    primary.append(all);
    subnav.replaceChildren(...tabs.map(pageButton));
    subnav.scrollLeft = horizontalPositions.get(group) || 0;
    const selected = $('[aria-current=page]', subnav);
    if (selected) {
      const left = selected.offsetLeft, right = left + selected.offsetWidth;
      if (left < subnav.scrollLeft || right > subnav.scrollLeft + subnav.clientWidth) {
        subnav.scrollLeft = Math.max(0, left - (subnav.clientWidth - selected.offsetWidth) / 2);
      }
    }
    if (directory.open) renderDirectory();
  }

  function noteNavigation(before) {
    const after = Tabs.currentTab();
    if (before !== after) {
      scrollPositions.set(before, window.scrollY);
      const previousGroup = Tabs.tabToTabGroup[before];
      horizontalPositions.set(previousGroup, subnav.scrollLeft);
    }
    renderNavigation();
    // The native loop updates again in 64ms; this makes a tap feel immediate.
    updateDisplay();
    // Restore after the new page is visible, otherwise the previous shorter
    // page can cause the browser to clamp a remembered long-page position.
    if (before !== after) window.scrollTo({ top: scrollPositions.get(after) || 0, behavior: 'instant' });
  }

  function adaptGenerator(page, config) {
    const table = $('table.ui-gen-table', page);
    if (!table) return;
    const host = table.parentElement;
    const max = $(`button[onclick="${config.max}"]`, page);
    const details = create('details', 'ui-gen-details');
    details.append(create('summary', '', 'Details, upgrades & other controls'));
    // Retain original containers so their conditional visibility remains intact.
    const promoted = [];
    for (const button of $$('button[onclick]', host)) {
      if (/^(Sacrifice\.sacrifice|Prestige\.prestige)/.test(button.getAttribute('onclick'))) {
        let node = button;
        while (node.parentElement && node.parentElement !== host) node = node.parentElement;
        if (!promoted.includes(node)) promoted.push(node);
      }
    }
    for (const node of [...host.childNodes]) {
      if (node !== table && !promoted.includes(node)) details.append(node);
    }
    const resource = create('div', 'ui-resource');
    const resourceMain = create('div', 'ui-resource-main');
    const amount = create('strong');
    resourceMain.append(create('span', '', config.currency), amount);
    const rate = create('div', 'ui-resource-rate');
    resource.append(resourceMain, rate);
    const toolbar = create('div', 'ui-gen-toolbar');
    toolbar.append(create('h1', '', config.title));
    const mode = create('div', 'ui-buy-mode', 'Buy: ');
    for (const value of ['1', 'max']) {
      const button = create('button', '', value.toUpperCase());
      button.type = 'button';
      button.dataset.buyMode = value;
      button.setAttribute('aria-label', value === '1' ? 'Buy one generator per tap' : 'Buy maximum generators per tap; displayed price is per unit');
      button.addEventListener('click', () => setBuyMode(value));
      mode.append(button);
    }
    toolbar.append(mode);
    table.before(resource, toolbar);
    const rows = $$('tr', table).map((row, index) => {
      const cells = [...row.children].filter(cell => cell.tagName === 'TD');
      const single = $('button', cells[4]), maximum = $('button', cells[5]);
      const nativeSingle = single.onclick;
      single.onclick = function (e) {
        if (single.classList.contains('disabled') || single.classList.contains('forbidden')) return;
        if (buyMode === 'max') maximum.click();
        else nativeSingle.call(this, e);
      };
      single.setAttribute('aria-label', `Buy ${config.title.toLowerCase()} tier ${index + 1}`);
      // Shorten only the static label; generated amount/multiplier nodes are untouched.
      const name = cells[0].firstChild;
      if (name && name.nodeType === Node.TEXT_NODE) name.textContent = name.textContent.replace(/^(Infinity|Eternity|Complexity|Finality) Generator/, 'Generator');
      const pricePrefix = single.firstChild;
      if (pricePrefix && pricePrefix.nodeType === Node.TEXT_NODE) pricePrefix.textContent = pricePrefix.textContent.replace('Cost: ', '');
      const auto = cells[6] ? $('button', cells[6]) : null;
      if (auto) {
        auto.setAttribute('aria-label', `Toggle autobuyer for generator tier ${index + 1}`);
        if (auto.firstChild.nodeType === Node.TEXT_NODE) auto.firstChild.textContent = 'Auto ';
      }
      return { row, single, auto };
    });
    const actions = create('div', 'ui-gen-actions');
    if (max) {
      max.setAttribute('aria-label', 'Max all');
      actions.append(max);
    }
    let boost;
    if (config.tab === 'main') {
      const original = $('button[onclick="Boost.buy()"]', details);
      if (original) {
        boost = { original, node: create('div', 'ui-boost'), label: create('span'), buy: create('button') };
        boost.buy.addEventListener('click', () => original.click());
        boost.node.append(boost.label, boost.buy);
        table.after(boost.node);
      }
    }
    (boost ? boost.node : table).after(actions);
    for (const node of promoted) {
      node.classList.add('ui-reset-strip');
      host.append(node);
    }
    host.append(details);
    generators.set(config.tab, { config, amount, rate, rows, table, boost });
  }

  function setBuyMode(value) {
    buyMode = value;
    for (const { table } of generators.values()) table.dataset.buyMode = value;
    $$('[data-buy-mode]').filter(n => n.tagName === 'BUTTON').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.buyMode === value)));
  }

  function renderGenerator() {
    const view = generators.get(Tabs.currentTab());
    if (!view) return;
    write(view.amount, view.config.amount());
    write(view.rate, view.config.rate());
    for (const { row, single, auto } of view.rows) {
      const autoVisible = !!auto && auto.style.display !== 'none';
      if (row.classList.contains('ui-has-auto') !== autoVisible) row.classList.toggle('ui-has-auto', autoVisible);
      attribute(single, 'aria-disabled', single.classList.contains('disabled') || single.classList.contains('forbidden'));
      if (auto && auto.title !== auto.textContent.trim()) auto.title = auto.textContent.trim();
    }
    if (view.boost) {
      const boost = view.boost;
      boost.node.hidden = boost.original.parentElement.parentElement.style.display === 'none';
      write(boost.label, `Boosts <strong>${formatInt(Boost.bought())}</strong> · All generators ×${format(Boost.multiplier())} `);
      const buyText = 'Buy · ' + boost.original.textContent.trim();
      if (boost.buy.textContent !== buyText) boost.buy.textContent = buyText;
      if (boost.buy.className !== boost.original.className) boost.buy.className = boost.original.className;
      attribute(boost.buy, 'aria-disabled', boost.original.classList.contains('disabled') || boost.original.classList.contains('forbidden'));
    }
  }

  function adaptTables() {
    for (const page of $$('.game-page')) {
      for (const table of $$('table', page).reverse()) {
        if (table.classList.contains('ui-gen-table')) continue;
        if ($('.study', table)) table.classList.add('ui-study-table');
        else if ($('.autobuyerdiv,.tallautobuyerdiv,.options-div,.options-button', table)) table.classList.add('ui-config-table');
        else if ($('.smallpowertd,.mediumpowertd,.largepowertd,.goaldiv,.eternitymilestonediv,.finalitymilestonediv,.chromadiv', table)) table.classList.add('ui-card-table');
        else if ($('.achievementtd', table)) table.classList.add('ui-achievement-table');
        else {
          const scroll = create('div', 'ui-scroll');
          scroll.tabIndex = 0;
          scroll.setAttribute('role', 'region');
          scroll.setAttribute('aria-label', 'Scrollable game table');
          table.before(scroll);
          scroll.append(table);
        }
      }
      $$('div[style*="width:"]', page).forEach(node => {
        if (!node.classList.contains('challengecontainer') && !node.closest('table')) node.classList.add('ui-wide-content');
      });
    }
  }

  function openHelp(target) {
    const tooltip = $('.tooltiptext,.headertooltiptext', target);
    if (!tooltip) return false;
    const clone = tooltip.cloneNode(true);
    clone.removeAttribute('id');
    $$('[id]', clone).forEach(n => n.removeAttribute('id'));
    $('#ui-help-body').replaceChildren(clone);
    if (!help.open) help.showModal();
    return true;
  }

  function mount() {
    main = $('#main');
    const firstPage = $('.game-page', main);
    if (!main || !firstPage) return;
    directory = makeDialog('ui-pages', 'All pages');
    resets = makeDialog('ui-resets', 'Resets & status');
    help = makeDialog('ui-help', 'Details');
    // Move the old header into a discoverable panel; preserve every original reset.
    const resetBody = $('#ui-resets-body');
    resetBody.className = 'ui-resets-body';
    for (const node of [...main.children]) {
      if (node === firstPage) break;
      const tabButtons = $$('button[onclick^="Tabs.setTab"]', node);
      if (tabButtons.length) {
        for (const button of tabButtons) {
          const match = button.getAttribute('onclick').match(/^Tabs\.setTab\('([^']+)'\)/);
          if (match) labels[match[1]] = button.textContent.trim();
        }
        node.classList.add('ui-legacy-nav');
        resetBody.append(node);
      } else {
        // Even spacer nodes may own generated b-IDs used by the native renderer.
        if (node.tagName === 'BR') node.classList.add('ui-legacy-nav');
        resetBody.append(node);
      }
    }
    const header = create('header', 'ui-header');
    header.append(create('span', 'ui-brand', 'FE000000'));
    const headerActions = create('div', 'ui-header-actions');
    const resetToggle = create('button', 'ui-resets-toggle', 'Resets');
    resetToggle.addEventListener('click', () => resets.showModal());
    themeButton = create('button');
    themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    const settings = create('button', '', '⚙');
    settings.setAttribute('aria-label', 'Options');
    settings.addEventListener('click', () => Tabs.setTab('options'));
    headerActions.append(resetToggle, themeButton, settings);
    header.append(headerActions);
    const global = create('div', 'ui-global-line');
    global.id = 'ui-global-stars';
    const originalStars = $('#e2');
    if (originalStars) global.append('Stars ', originalStars);
    // Challenge status remains in sight even with the detailed reset panel closed.
    const status = create('div', 'ui-global-line');
    status.id = 'ui-active-status';
    for (const id of ['e3', 'e4']) { const n = $('#' + id); if (n) status.append(n); }
    const subWrapper = create('nav', 'ui-subnav');
    subWrapper.setAttribute('aria-label', 'Pages in current group');
    subnav = create('div', 'ui-subnav-scroll');
    const expand = create('button', 'ui-nav-expand', '⌄');
    expand.setAttribute('aria-label', 'Choose from all unlocked pages');
    expand.addEventListener('click', openPages);
    subWrapper.append(subnav, expand);
    main.prepend(header, global, status, subWrapper);
    primary = create('nav', 'ui-primary-nav');
    primary.setAttribute('aria-label', 'Game groups');
    main.append(primary);

    const configs = [
      { tab:'main', title:'Normal generators', currency:'Stars', max:'HotkeyMaxAll.trigger(true)', amount:()=>format(Stars.amount()), rate:()=>`${format(Stars.perSecond())} stars / sec` },
      { tab:'infinity', title:'Infinity generators', currency:'Infinity points', max:'InfinityMaxAll.maxAll()', amount:()=>formatInt(InfinityPoints.amount()), rate:()=>`${format(InfinityStars.amount())} infinity stars · +${format(InfinityStars.perSecond())}/sec` },
      { tab:'eternity', title:'Eternity generators', currency:'Eternity points', max:'EternityMaxAll.maxAll()', amount:()=>formatInt(EternityPoints.amount()), rate:()=>`${format(EternityStars.amount())} eternity stars · +${format(EternityStars.perSecond())}/sec` },
      { tab:'complexity', title:'Complexity generators', currency:'Complexity points', max:'ComplexityMaxAll.maxAll()', amount:()=>formatInt(ComplexityPoints.amount()), rate:()=>`${format(ComplexityStars.amount())} complexity stars · +${format(ComplexityStars.perSecond())}/sec` },
      { tab:'finality', title:'Finality generators', currency:'Finality points', max:'FinalityMaxAll.maxAll()', amount:()=>formatInt(FinalityPoints.amount()), rate:()=>`${format(FinalityStars.amount())} finality stars · +${format(FinalityStars.perSecond())}/sec` }
    ];
    for (const config of configs) adaptGenerator($(`[data-tab="${config.tab}"]`), config);
    adaptTables();
    setBuyMode('1');
    const appearance = create('section', 'ui-appearance');
    appearance.append(create('h2', '', 'Appearance'));
    for (const value of ['light','dark','system']) {
      const b = create('button', '', groupLabel(value));
      b.dataset.uiTheme = value;
      b.addEventListener('click', () => setTheme(value));
      appearance.append(b);
    }
    $('[data-tab=options]').prepend(appearance);
    setTheme(theme, false);
    themeMedia.addEventListener('change', () => { if (theme === 'system') setTheme(theme, false); });
    const nativeBackground = Options.nextBackground;
    Options.nextBackground = function () { nativeBackground.call(this); setTheme(Options.background().toLowerCase()); };
    const nativeSetTab = Tabs.setTab, nativeSetGroup = Tabs.setTabGroup;
    Tabs.setTab = function (key) {
      if (!Tabs.isTabVisibleRaw(key)) return;
      const before = this.currentTab();
      nativeSetTab.call(this, key);
      noteNavigation(before);
    };
    Tabs.setTabGroup = function (key) {
      if (!visibleTabs(key).length) return;
      const before = this.currentTab();
      nativeSetGroup.call(this, key);
      noteNavigation(before);
    };
    $$('span.helpspan').forEach(n => {
      n.tabIndex = 0;
      n.setAttribute('role', 'button');
      n.setAttribute('aria-label', 'Show explanation');
    });
    document.addEventListener('click', e => {
      if (e.target.closest('.ui-dialog')) return;
      const target = e.target.closest('.helpspan,.achievementtd');
      if (target && openHelp(target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('keydown', e => {
      if (directory.open || resets.open || help.open) { e.stopPropagation(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.helpspan')) {
        e.preventDefault(); openHelp(e.target);
      }
    }, true);
    ready = true;
    renderNavigation();
    window.FEUI = { openPages, setTheme, setBuyMode };
  }
  // Saving initializes `player` on load, not DOMContentLoaded. Mount only once
  // that has happened. Retained native nodes keep their cached e/b references;
  // the original major-div visibility boundaries are not changed.
  const nativeUpdate = updateDisplay;
  window.updateDisplay = function () {
    if (!ready && player) {
      mount();
    }
    nativeUpdate();
    if (!ready) return;
    renderNavigation();
    renderGenerator();
    $('#ui-global-stars').hidden = generators.has(Tabs.currentTab());
    $('#ui-active-status').hidden = !$('#ui-active-status').textContent.trim();
    currentTab = Tabs.currentTab();
    setTheme(theme, false);
  };
})();
