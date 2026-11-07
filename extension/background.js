'use strict';
// The Frenzi extension: your companion browses in a window of her own in this browser, so she has your
// sign-ins (Amazon, Discord, Reddit…) without anyone remote-controlling your profile.
//
//   - It talks only to Frenzi on this PC (ws://127.0.0.1, the port below). When Frenzi isn't running it
//     does nothing but look again every half minute.
//   - She uses only the tab she opened, in her own window (a purple "Frenzi" tab group). Your tabs and
//     windows are never read or touched.
//   - What she can do is fixed here: open a page, read it, scroll, click, type (never into a password
//     field), go back, show her window. Frenzi decides when; the hard rules (no passwords, drafts shown
//     before anything is sent, posted or bought, no CAPTCHAs) are kept there.
importScripts('page-reader.js');

const PORT = 47613; // the port the Frenzi app listens on (FRENZI_EXTENSION_PORT in its extension-bridge.js)
const LOAD_TIMEOUT_MS = 20000;

let ws = null;
let retry = null;
let backoff = 1000;

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function status(on) {
  chrome.action.setTitle({ title: on ? 'Frenzi: connected' : 'Frenzi isn’t running' }).catch(() => {});
  chrome.action.setBadgeText({ text: on ? '' : 'off' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#6b5b95' }).catch(() => {});
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  clearTimeout(retry);
  let sock;
  try {
    sock = new WebSocket(`ws://127.0.0.1:${PORT}/frenzi`);
  } catch {
    return later();
  }
  ws = sock;
  sock.onopen = () => {
    backoff = 1000;
    status(true);
    send({ type: 'hello', version: chrome.runtime.getManifest().version, agent: navigator.userAgent });
  };
  sock.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg && msg.id != null && msg.op) handle(msg);
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    status(false);
    later();
  };
  sock.onerror = () => {};
}

function later() {
  clearTimeout(retry);
  retry = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 30000);
}

// A service worker sleeps when idle: the alarm wakes it to look for Frenzi, and the heartbeat keeps an open
// connection (and the worker) alive.
chrome.alarms.create('frenzi-look', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => connect());
setInterval(() => send({ type: 'ping' }), 20000);
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
chrome.action.onClicked.addListener(() => show().catch(() => {}));
connect();

// --- her window and tab ---

async function remembered() {
  const s = await chrome.storage.session.get(['tabId', 'windowId']);
  if (s.tabId == null) return null;
  try {
    return await chrome.tabs.get(s.tabId);
  } catch {
    return null;
  }
}

/** Her tab, in her own window (made when there is none: you may have closed it). */
async function herTab() {
  const had = await remembered();
  if (had) return had;
  const win = await chrome.windows.create({ url: 'about:blank', focused: false, state: 'normal' });
  const tab = win.tabs[0];
  try {
    const group = await chrome.tabs.group({ tabIds: [tab.id], createProperties: { windowId: win.id } });
    await chrome.tabGroups.update(group, { title: 'Frenzi', color: 'purple' });
  } catch {
    /* tab groups off: the window alone is hers */
  }
  await chrome.storage.session.set({ tabId: tab.id, windowId: win.id });
  return tab;
}

async function show() {
  const tab = await herTab();
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  return true;
}

function loaded(tabId, kick) {
  return new Promise((resolve) => {
    let started = false;
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(on);
      resolve();
    };
    const on = (id, info) => {
      if (id !== tabId) return;
      if (info.status === 'loading') started = true;
      if (info.status === 'complete' && started) done();
    };
    const timer = setTimeout(done, LOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(on);
    Promise.resolve()
      .then(kick)
      .catch(done);
    // Nothing started loading (a hash change, a page that went nowhere): don't wait the whole timeout.
    setTimeout(() => {
      if (!started) done();
    }, 2500);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function frenziScroll(up) {
  window.scrollBy({ top: (up ? -1 : 1) * Math.round(innerHeight * 0.85), behavior: 'smooth' });
  return true;
}

function frenziBack() {
  history.back();
  return true;
}

const IN_PAGE = { read: frenziReadPage, target: frenziTarget, ready: frenziReady, click: frenziClick, type: frenziType, scroll: frenziScroll };

async function inPage(tabId, fn, args) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: IN_PAGE[fn], args: args ?? [] });
  return r ? r.result : null;
}

const OPS = {
  async open({ url, focus }) {
    if (!/^https?:\/\//i.test(String(url))) throw new Error('only web pages');
    const tab = await herTab();
    if (focus) await show().catch(() => {});
    await loaded(tab.id, () => chrome.tabs.update(tab.id, { url: String(url) }));
    await sleep(700); // let scripts draw the page
    return true;
  },
  async run({ fn, args }) {
    if (!IN_PAGE[fn]) throw new Error(`no such page action: ${fn}`);
    const tab = await herTab();
    return inPage(tab.id, fn, args);
  },
  async back() {
    const tab = await herTab();
    await loaded(tab.id, () => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: frenziBack }));
    await sleep(700);
    return true;
  },
  show: () => show(),
  async url() {
    const tab = await remembered();
    return tab ? tab.url ?? null : null;
  },
};

async function handle(msg) {
  try {
    if (!Object.prototype.hasOwnProperty.call(OPS, msg.op)) throw new Error(`unknown op ${msg.op}`);
    const result = await OPS[msg.op](msg);
    send({ id: msg.id, ok: true, result: result ?? null });
  } catch (err) {
    send({ id: msg.id, ok: false, error: String((err && err.message) || err) });
  }
}
