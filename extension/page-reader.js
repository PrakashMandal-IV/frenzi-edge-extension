'use strict';
// The page reader and page hands, shared by her two browsers:
//   - Frenzi's own browser (in the Frenzi app) runs them over the DevTools protocol, as source text;
//   - the Frenzi extension in your Edge (background.js) runs them with chrome.scripting.executeScript.
// Each function is self-contained (it runs inside the page, with nothing from here in scope).

/** What the page says (the part on screen, or the whole main content) and what can be used on it, numbered. */
function frenziReadPage(viewOnly, maxText, maxItems) {
  for (const e of document.querySelectorAll('[data-frenzi-ref]')) e.removeAttribute('data-frenzi-ref');
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const inView = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  let text = '';
  if (viewOnly) {
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const parts = [];
    let n = 0;
    let last = null;
    while (w.nextNode() && n < 6000) {
      n++;
      const t = w.currentNode;
      const v = clean(t.textContent);
      if (!v) continue;
      const p = t.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
      if (p.closest('nav,[role=navigation],[role=menu],[aria-hidden="true"],[hidden],dialog:not([open])')) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      if (!r.width || !inView(r)) continue;
      const block = p.closest('p,li,h1,h2,h3,h4,h5,h6,article,div,section,td,tr');
      parts.push((block !== last ? '\n' : ' ') + v);
      last = block;
    }
    text = parts.join('').replace(/\n\s*\n+/g, '\n').trim();
  } else {
    const root = document.querySelector('main,[role=main],article') || document.body || document.documentElement;
    text = (root.innerText || '').replace(/\n\s*\n+/g, '\n').trim();
  }
  const items = [];
  let ref = 0;
  for (const el of document.querySelectorAll('a[href],button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=searchbox],[contenteditable="true"]')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (viewOnly && !inView(r)) continue;
    const tag = el.tagName;
    const role = el.getAttribute('role');
    if (tag === 'INPUT' && /^(hidden|submit|button|checkbox|radio|file|image|reset)$/i.test(el.type) && !/^(submit|button)$/i.test(el.type)) continue;
    const kind = tag === 'A' || role === 'link' ? 'link' : (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !/^(submit|button)$/i.test(el.type)) || el.isContentEditable || role === 'textbox' || role === 'searchbox' ? 'field' : 'button';
    const label = clean(el.getAttribute('aria-label') || (kind === 'field' ? '' : el.innerText) || el.value || el.placeholder || el.title || el.name || el.getAttribute('alt')).slice(0, 90);
    if (!label && kind !== 'field') continue;
    el.setAttribute('data-frenzi-ref', String(++ref));
    items.push({ ref, kind, label: label || el.placeholder || el.name || 'text field', ...(kind === 'link' && el.href ? { href: String(el.href).slice(0, 220) } : {}), ...(el.type === 'password' ? { password: true } : {}) });
    if (ref >= maxItems) break;
  }
  const doc = document.documentElement;
  return { url: location.href, title: document.title, text: text.slice(0, maxText), truncated: text.length > maxText, items, scroll: { y: Math.round(scrollY), height: doc.scrollHeight, viewport: innerHeight, atEnd: scrollY + innerHeight >= doc.scrollHeight - 4 } };
}

/** What a numbered thing is and where (scrolled into view), or null when the number is gone. */
function frenziTarget(ref) {
  const el = document.querySelector(`[data-frenzi-ref="${Number(ref)}"]`);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName, type: el.type || '', label: (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '').trim().slice(0, 90), password: el.type === 'password', href: el.href || null, form: !!el.form };
}

/** Whether the page has a document with a body that has finished parsing. */
function frenziReady() {
  return !!document.body && document.readyState !== 'loading';
}

/** A click as a person makes one: pointer and mouse events at its middle, then click(). */
function frenziClick(ref) {
  const el = document.querySelector(`[data-frenzi-ref="${Number(ref)}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
  el.dispatchEvent(new PointerEvent('pointerover', at));
  el.dispatchEvent(new MouseEvent('mouseover', at));
  el.dispatchEvent(new PointerEvent('pointerdown', { ...at, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  el.dispatchEvent(new PointerEvent('pointerup', at));
  el.dispatchEvent(new MouseEvent('mouseup', at));
  el.click();
  return true;
}

/**
 * Type into a field, replacing what is there, the way frameworks notice (the native value setter plus input
 * and change events; inserted text for rich editors). `submit`: Enter, then the form is submitted if it
 * has one. Never into a password field.
 */
function frenziType(ref, text, submit) {
  const el = document.querySelector(`[data-frenzi-ref="${Number(ref)}"]`);
  if (!el) return { error: 'gone' };
  if (el.type === 'password') return { error: 'password' };
  el.focus();
  if (el.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (!document.execCommand('insertText', false, String(text))) el.textContent = String(text);
  } else {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, String(text));
    else el.value = String(text);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: String(text) }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (submit) {
    const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
    const go = el.dispatchEvent(new KeyboardEvent('keydown', key));
    el.dispatchEvent(new KeyboardEvent('keypress', key));
    el.dispatchEvent(new KeyboardEvent('keyup', key));
    if (go && el.form) {
      if (typeof el.form.requestSubmit === 'function') el.form.requestSubmit();
      else el.form.submit();
    }
  }
  return { ok: true };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { frenziReadPage, frenziTarget, frenziReady, frenziClick, frenziType };
