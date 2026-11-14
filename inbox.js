/* The feedback inbox: the developer signs in with their Thara account and
   reads what visitors sent through the site's form.

   Signing in is the app's own: `hello` says how many rounds, then the
   password's proof is made here (PBKDF2-SHA-256 over the password, salted
   with "thara-auth-v2:" and the email) and only the proof is sent. The
   gateway answers with a session token alone, kept in this tab's session
   storage and ended by Sign out. Everything a visitor wrote is put on the
   page as text, never as markup. */
(function () {
  'use strict';

  var gw = window.tharaGateway;
  if (!gw || !window.crypto || !crypto.subtle) return;

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function keep(k, v) {
    try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* fine */ }
  }
  function kept(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  var signinBox = $('#in-signin');
  var mainBox = $('#in-main');
  var form = $('#in-form');
  var status = $('#in-status');
  var listStatus = $('#in-list-status');
  var list = $('#in-list');
  var empty = $('#in-empty');
  var more = $('#in-more');
  var find = $('#in-find');

  var state = { token: kept('thara-inbox-token'), email: kept('thara-inbox-email'), show: 'new', items: [], more: false, counts: { new: 0, done: 0 } };

  function say(el, words, bad) {
    el.textContent = words || '';
    el.classList.toggle('bad', !!bad);
  }

  function b64url(buffer) {
    var bytes = new Uint8Array(buffer);
    var text = '';
    for (var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function proof(email, password, rounds) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('thara-auth-v2:' + email), iterations: rounds }, key, 256);
      })
      .then(b64url);
  }

  /* ---------- signing in and out ---------- */

  function showSignin(words, bad) {
    state.token = null;
    keep('thara-inbox-token', null);
    mainBox.hidden = true;
    signinBox.hidden = false;
    say(status, words, bad);
  }

  function showMain() {
    signinBox.hidden = true;
    mainBox.hidden = false;
    $('#in-who').textContent = state.email ? 'Signed in as ' + state.email : '';
    load(false);
  }

  function signinWords(answer) {
    var reason = gw.reason(answer);
    if (reason === 'cloud_wrong') return 'The email or the password is not right.';
    if (reason === 'not_admin') return 'This account cannot read feedback.';
    if (reason === 'cloud_attempts') return 'Too many sign-in tries today. Try again tomorrow.';
    if (reason === 'minute') return 'Too many tries at once. Wait a minute.';
    return 'Signing in did not work just now. Try again in a little while.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim().toLowerCase();
    var password = form.password.value;
    if (!email || !password) { say(status, 'Enter the email and the password.', true); return; }
    var button = form.querySelector('button');
    button.disabled = true;
    say(status, 'Checking…');
    gw.ask({ op: 'hello', email: email }).then(function (hello) {
      if (hello.status !== 200) throw hello;
      if (!hello.body.password) {
        throw { words: hello.body.google
          ? 'This account signs in with Google only. Set a password for it in the app (Forgot password), then sign in here.'
          : 'The email or the password is not right.' };
      }
      return proof(email, password, hello.body.rounds || 60000);
    }).then(function (auth) {
      return gw.ask({ op: 'signin', email: email, auth: auth });
    }).then(function (signed) {
      button.disabled = false;
      if (signed.status !== 200) { say(status, signinWords(signed), true); return; }
      form.password.value = '';
      state.token = signed.body.token;
      state.email = signed.body.email;
      keep('thara-inbox-token', state.token);
      keep('thara-inbox-email', state.email);
      say(status, '');
      showMain();
    }, function (failure) {
      button.disabled = false;
      if (failure && failure.words) say(status, failure.words, true);
      else if (failure && failure.status) say(status, signinWords(failure), true);
      else say(status, 'Thara\'s server could not be reached. Check the connection and try again.', true);
    });
  });

  $('#in-signout').addEventListener('click', function () {
    var token = state.token;
    showSignin('Signed out.');
    if (token) gw.ask({ op: 'signout', token: token }).catch(function () { /* the session ends by itself */ });
  });

  /* ---------- the list ---------- */

  var KINDS = { broken: 'Something broken', confusing: 'Confusing', missing: 'Missing', idea: 'An idea', other: 'Other' };
  var TONES = { broken: 'peach', confusing: 'violet', missing: 'violet', idea: 'lime', other: 'plain' };

  function when(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(name) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'i');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function card(item) {
    var li = el('li', 'in-item' + (item.done ? ' done' : ''));
    li.setAttribute('data-id', item.id);

    var top = el('div', 'in-top');
    top.appendChild(el('span', 'tag ' + (TONES[item.kind] || 'plain'), KINDS[item.kind] || item.kind));
    top.appendChild(el('span', 'in-when', when(item.at)));
    if (item.lang === 'ar') top.appendChild(el('span', 'tag plain', 'Arabic'));
    if (item.done) top.appendChild(el('span', 'tag plain', 'Handled'));
    li.appendChild(top);

    var text = el('p', 'in-text', item.text);
    text.setAttribute('dir', 'auto');
    li.appendChild(text);

    var facts = [];
    if (item.build) facts.push('Build ' + item.build);
    if (item.phone) facts.push(item.phone);
    if (facts.length || item.contact) {
      var meta = el('p', 'in-meta');
      if (facts.length) meta.appendChild(el('span', null, facts.join(' · ')));
      if (item.contact) {
        var a = el('a', 'in-contact');
        a.href = 'mailto:' + item.contact + '?subject=' + encodeURIComponent('Your Thara feedback');
        a.appendChild(icon('mail'));
        a.appendChild(document.createTextNode(item.contact));
        meta.appendChild(a);
      }
      li.appendChild(meta);
    }

    var acts = el('div', 'in-item-acts');
    var mark = el('button', 'btn ghost');
    mark.type = 'button';
    mark.appendChild(icon(item.done ? 'undo' : 'check'));
    mark.appendChild(document.createTextNode(item.done ? 'Mark as new' : 'Mark handled'));
    mark.addEventListener('click', function () { setDone(item, !item.done, mark); });
    var del = el('button', 'btn ghost in-del');
    del.type = 'button';
    del.appendChild(icon('trash'));
    del.appendChild(document.createTextNode('Delete'));
    del.addEventListener('click', function () { remove(item, del); });
    acts.appendChild(mark);
    acts.appendChild(del);
    li.appendChild(acts);
    return li;
  }

  function render() {
    var q = find.value.trim().toLowerCase();
    var shown = state.items.filter(function (i) {
      if (!q) return true;
      return [i.text, i.contact, i.phone, KINDS[i.kind], i.build && String(i.build)]
        .some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
    });
    list.textContent = '';
    shown.forEach(function (i) { list.appendChild(card(i)); });
    empty.hidden = shown.length > 0;
    empty.textContent = q ? 'Nothing loaded matches that.' : state.show === 'new' ? 'Nothing new. All caught up.' : 'Nothing here.';
    more.hidden = !state.more;
    $$('[data-tally]').forEach(function (b) { b.textContent = state.counts[b.getAttribute('data-tally')] || 0; });
    $$('[data-show]').forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-show') === state.show)); });
  }

  function signedOutIf(answer) {
    if (gw.reason(answer) === 'cloud_session' || gw.reason(answer) === 'not_admin') {
      showSignin(gw.reason(answer) === 'not_admin' ? 'This account cannot read feedback.' : 'Signed out. Sign in again.', true);
      return true;
    }
    return false;
  }

  function load(older) {
    var body = { op: 'list', token: state.token, show: state.show };
    if (older && state.items.length) body.before = state.items[state.items.length - 1].at;
    say(listStatus, 'Loading…');
    more.disabled = true;
    return gw.ask(body).then(function (answer) {
      more.disabled = false;
      if (signedOutIf(answer)) return;
      if (answer.status !== 200) { say(listStatus, 'The list could not be loaded just now.', true); return; }
      state.items = older ? state.items.concat(answer.body.items) : answer.body.items;
      state.more = answer.body.more;
      state.counts = answer.body.counts;
      say(listStatus, '');
      render();
    }, function () {
      more.disabled = false;
      say(listStatus, 'Thara\'s server could not be reached.', true);
    });
  }

  function setDone(item, done, button) {
    button.disabled = true;
    gw.ask({ op: 'mark', token: state.token, id: item.id, done: done }).then(function (answer) {
      button.disabled = false;
      if (signedOutIf(answer)) return;
      if (answer.status === 404) { dropLocal(item); return; }
      if (answer.status !== 200) { say(listStatus, 'That could not be changed just now.', true); return; }
      item.done = done;
      state.counts[done ? 'new' : 'done'] = Math.max(0, state.counts[done ? 'new' : 'done'] - 1);
      state.counts[done ? 'done' : 'new'] += 1;
      if (state.show !== 'all') state.items = state.items.filter(function (i) { return i !== item; });
      render();
    }, function () {
      button.disabled = false;
      say(listStatus, 'Thara\'s server could not be reached.', true);
    });
  }

  function dropLocal(item) {
    state.items = state.items.filter(function (i) { return i !== item; });
    var bucket = item.done ? 'done' : 'new';
    state.counts[bucket] = Math.max(0, state.counts[bucket] - 1);
    render();
  }

  function remove(item, button) {
    if (!window.confirm('Delete this message for good? It cannot be brought back.')) return;
    button.disabled = true;
    gw.ask({ op: 'delete', token: state.token, id: item.id }).then(function (answer) {
      button.disabled = false;
      if (signedOutIf(answer)) return;
      if (answer.status !== 200 && answer.status !== 404) { say(listStatus, 'That could not be deleted just now.', true); return; }
      dropLocal(item);
    }, function () {
      button.disabled = false;
      say(listStatus, 'Thara\'s server could not be reached.', true);
    });
  }

  $$('[data-show]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.show = chip.getAttribute('data-show');
      state.items = [];
      render();
      load(false);
    });
  });
  more.addEventListener('click', function () { load(true); });
  $('#in-refresh').addEventListener('click', function () { load(false); });
  find.addEventListener('input', render);

  if (state.token) showMain();
})();
