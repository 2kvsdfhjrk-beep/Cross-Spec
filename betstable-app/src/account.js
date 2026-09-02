/* account.js — signing up for a handle.
   A handle is the thing a record is attached to, so it is claimed once and
   never reassigned. Everything here lives on the device; a real build would
   put the same shapes behind an API. */
(function (BS) {
  'use strict';
  const KEY = 'betstable.account.v1';
  let account = null;

  function load() {
    if (account !== null) return account;
    try {
      const raw = localStorage.getItem(KEY);
      account = raw ? JSON.parse(raw) : false;
    } catch (e) { account = false; }
    return account;
  }
  function save() {
    try {
      if (account) localStorage.setItem(KEY, JSON.stringify(account));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** Reserved: every handle already carrying a public record. */
  function taken(handle) {
    const h = '@' + handle.toLowerCase();
    return BS.tipsters.all().some(t => t.handle.toLowerCase() === h);
  }

  /** Returns null when valid, otherwise the reason — in words a person can act on. */
  function checkHandle(raw) {
    const h = String(raw || '').trim().replace(/^@/, '').toLowerCase();
    if (!h) return 'Pick a handle — it is the name your record is published under.';
    if (h.length < 3) return 'Handles are at least 3 characters.';
    if (h.length > 20) return 'Handles are at most 20 characters.';
    if (!HANDLE_RE.test(h)) return 'Letters, numbers and underscores only.';
    if (taken(h)) return '@' + h + ' is already taken.';
    return null;
  }
  const checkEmail = raw => EMAIL_RE.test(String(raw || '').trim())
    ? null : 'That does not look like an email address.';

  function create(opts) {
    const hErr = checkHandle(opts.handle), eErr = checkEmail(opts.email);
    if (hErr) return { error: hErr, field: 'handle' };
    if (eErr) return { error: eErr, field: 'email' };
    if (!opts.age) return { error: 'You must confirm you are 18 or over.', field: 'age' };
    account = {
      handle: '@' + String(opts.handle).trim().replace(/^@/, '').toLowerCase(),
      email: String(opts.email).trim(),
      // Off unless asked for, and honoured everywhere once asked to stop.
      marketing: !!opts.marketing,
      createdAt: Date.now()
    };
    save();
    BS.store.setHandle(account.handle);
    return { account: account };
  }

  function signOut() {
    account = false;
    save();
  }

  BS.account = {
    get: () => load() || null,
    isSignedIn: () => !!load(),
    handle: () => (load() || {}).handle || null,
    create, signOut, checkHandle, checkEmail
  };
})(window.BS = window.BS || {});
