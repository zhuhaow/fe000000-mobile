import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { parseHTML } = await import(process.env.FE_DOM_MODULE ? pathToFileURL(process.env.FE_DOM_MODULE).href : 'linkedom');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function game({ legacy = false } = {}) {
  const { window: domWindow, document } = parseHTML(html);
  const window = { document, HTMLElement:domWindow.HTMLElement, Node:domWindow.Node, Event:domWindow.Event };
  window.window = window;
  window.self = window;
  const storage = new Map(), events = new Map(), timers = new Map();
  let timerId = 0;
  Object.assign(window, {
    console, URLSearchParams, performance, structuredClone, TextEncoder, TextDecoder,
    location: { search: legacy ? '?legacy=1' : '', reload() {} },
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
    setTimeout: f => { timers.set(++timerId,f); return timerId; }, clearTimeout: id => timers.delete(id),
    setInterval: () => ++timerId, clearInterval() {},
    alert: message => { throw new Error('Unexpected game alert: ' + message); }, confirm: () => true, prompt: () => null,
    btoa: v => Buffer.from(v,'binary').toString('base64'), atob: v => Buffer.from(v,'base64').toString('binary'),
    innerWidth:390, innerHeight:780, scrollY:0,
    scrollTo(options) { this.scrollY = typeof options === 'object' ? options.top : 0; },
    getComputedStyle: node => node.style,
  });
  window.addEventListener = (name, f) => { if (!events.has(name)) events.set(name, []); events.get(name).push(f); };
  window.HTMLElement.prototype.showModal = function () { this.open = true; this.setAttribute('open',''); };
  window.HTMLElement.prototype.close = function () { this.open = false; this.removeAttribute('open'); };
  window.HTMLElement.prototype.focus = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const context = vm.createContext(window);
  for (const script of document.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src').split('?')[0];
    vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename:src });
  }
  for (const node of document.querySelectorAll('[onclick]')) {
    node.onclick = vm.runInContext('(function(event){' + node.getAttribute('onclick') + '})',context);
  }
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const run = code => vm.runInContext(code, context);
  // Initialize deterministically, without real timers or a user's browser storage.
  run('updateDisplayPageLoadSetup(); player = initialPlayer; updateDisplaySaveLoadSetup(); updateDisplay();');
  return { run, window, document, storage };
}

test('all local runtime assets exist and generated bindings retain unique IDs', () => {
  const { document } = parseHTML(html);
  for (const n of document.querySelectorAll('script[src],link[href]')) {
    const src = (n.getAttribute('src') || n.getAttribute('href')).split('?')[0];
    if (!/^https?:/.test(src)) assert.ok(fs.existsSync(path.join(root,src)),src);
  }
  const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(document.querySelectorAll('.game-page').length,25);
  assert.equal(document.querySelectorAll('.ui-gen-table').length,5);
});

test('fresh game mounts without exposing locked navigation', () => {
  const g = game();
  const nav = g.document.querySelector('.ui-primary-nav').textContent;
  assert.match(nav,/Normal/);
  assert.doesNotMatch(nav,/Infinity|Eternity|Complexity/);
  g.window.FEUI.openPages();
  const pages = g.document.querySelector('#ui-pages-body').textContent;
  assert.doesNotMatch(pages,/Infinity|Eternity|Complexity|Powers|Oracle|Galaxies/);
  assert.equal(g.document.querySelectorAll('[data-tab=main] .ui-gen-table tr').length,8);
  const original = parseHTML(html).document;
  for (const node of original.querySelectorAll('[id]')) assert.ok(g.document.getElementById(node.id),'Preserved original binding: ' + node.id);
  const mountedIDs = [...g.document.querySelectorAll('[id]')].map(n=>n.id);
  assert.equal(new Set(mountedIDs).size,mountedIDs.length,'Mounted UI must not duplicate native IDs');
});

test('single and max purchase controls invoke the native game purchases', () => {
  const g = game();
  g.run('player.stars = new Decimal(1e6); updateDisplay();');
  const button = g.document.querySelector('[data-tab=main] .ui-gen-table tr td:nth-child(5) button');
  const before = g.run('Generator(1).bought()');
  button.click();
  assert.equal(g.run('Generator(1).bought()'),before + 1);
  g.window.FEUI.setBuyMode('max');
  button.click();
  assert.ok(g.run('Generator(1).bought()') > before + 1);
  assert.ok(g.run('Stars.amount().gte(0)'));
});

test('all unlocked pages render through Complexity and keep group/page state', () => {
  const g = game();
  g.run(`player.infinities=10; player.eternities=new Decimal(10); player.complexities=1;
    for (const key of ['infinity-challenges','eternity-producer','eternity-challenges','chroma','powers','oracle','galaxies']) player.isTabVisible[key]=true;
    updateDisplay();`);
  const keys = g.run('Tabs.groups.flatMap(g=>Tabs.tabGroupToTab[g]).filter(k=>Tabs.isTabVisibleRaw(k))');
  for (const key of keys) {
    g.run(`Tabs.setTab(${JSON.stringify(key)}); updateDisplay();`);
    assert.equal(g.run('Tabs.currentTab()'),key);
    assert.notEqual(g.document.querySelector(`[data-tab="${key}"]`).style.display,'none');
  }
  g.run("Tabs.setTab('studies'); Tabs.setTabGroup('complexity'); Tabs.setTabGroup('eternity');");
  assert.equal(g.run('Tabs.currentTab()'),'studies');
  g.window.FEUI.openPages();
  assert.equal(g.document.querySelectorAll('#ui-pages-body [data-page]').length,22);
  assert.doesNotMatch(g.document.querySelector('#ui-pages-body').textContent,/Finality/);
});

test('theme choice and save serialization preserve progression', () => {
  const g = game();
  g.run('player.stars=new Decimal(123456); player.infinities=7;');
  g.window.FEUI.setTheme('light');
  assert.equal(g.document.documentElement.dataset.theme,'light');
  assert.equal(g.run('Options.background()'),'Light');
  const encoded = g.run('Saving.encode(player)');
  assert.ok(typeof encoded === 'string' && encoded.length > 100);
  g.run(`Saving.loadGame(${JSON.stringify(encoded)}, null, null, false, ()=>{});`);
  assert.equal(g.run('player.infinities'),7);
  assert.equal(g.run('player.stars.toNumber()'),123456);
});

test('classic presentation remains available', () => {
  const g = game({ legacy:true });
  assert.ok(!g.document.documentElement.classList.contains('modern-ui'));
  assert.equal(g.document.querySelector('.ui-primary-nav'),null);
});
