/* Thara site: the app's interactivity on the page.

   Every effect decorates what is already there, as in the app: links are
   real links, folds are <details>, and with no script the page still reads
   and every download works. With motion off (the phone's "reduce motion"
   or the Effects switch) everything shows settled at once.

   Preferences are the same keys the demo uses, so a choice made on one
   page holds on the other: thara-theme, thara-hide, thara-motion. They are
   only conveniences; private windows that refuse storage lose nothing.
   thara-survey-later is when this browser last said "Not now" to the
   survey's card (or went to the survey from it). */
(function () {
  'use strict';
  window.tharaSite = true;

  var root = document.documentElement;
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ }
  }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function moving() { return !reduce.matches && root.getAttribute('data-motion') !== 'off'; }
  function syncMotion() { root.classList.toggle('motion', moving()); }
  function later(fn) { return moving() ? setTimeout(fn, 270) : fn(); }
  function reflow(el) { return el.offsetWidth; }

  /* ---------- Arabic and English ----------
     Each page is written in English. Its Arabic is in i18n/ar-*.js, keyed
     by the English it stands for: a whole short block (a paragraph, a
     heading, a line of a list, with its bold and its links), or a single
     piece of text beside an icon or a figure. A block that already carries
     its own Arabic beside the English (Records <span lang="ar">…</span>)
     shows that Arabic. Anything with no Arabic stays English, so a sentence
     changed on the page before its Arabic is shows the new English, never
     an old translation. Elements marked data-l="en" or data-l="ar" show in
     that language only (style.css). What this file writes itself comes in
     both languages where it is written (pick).

     The choice is thara-lang, shared with the demo. With none, the
     browser's own language decides; the head of each page sets lang and
     dir before the first paint, and hides the page (i18n-wait) until the
     Arabic is in place. Pages without data-langs (the developer's inbox)
     stay English. */
  var AR = window.tharaArabic || {};
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function lang() { return root.getAttribute('lang') === 'ar' ? 'ar' : 'en'; }
  function pick(en, ar) { return lang() === 'ar' ? ar : en; }
  var langHooks = [];
  function onLang(fn) { langHooks.push(fn); }

  var I18N = root.hasAttribute('data-langs');
  var units = [];
  var attrUnits = [];
  var titleUnit = null;
  var DYNAMIC = '[data-money],[data-version-build],[data-version-date],[data-asset],[data-today],[data-month],[data-keep],[data-l],[data-lang-toggle]';
  var COMPLEX = 'svg,input,textarea,select,button,img,' + DYNAMIC;
  var XHTML = 'http://www.w3.org/1999/xhtml';

  function squash(s) { return s.replace(/\s+/g, ' ').trim(); }
  function directText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true;
    return false;
  }
  // "Records <span lang="ar">العمليات</span>": the one child in Arabic.
  function ownArabic(el) {
    var found = null, n = 0;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      n++;
      if (c.getAttribute('lang') === 'ar') found = c;
    }
    return n === 1 && found ? squash(found.innerHTML) : null;
  }
  function collect(el) {
    if (el.namespaceURI !== XHTML || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return;
    if (el.hasAttribute('lang') || el.matches(DYNAMIC)) return;
    if (directText(el) && !el.querySelector(COMPLEX)) {
      units.push({ el: el, en: el.innerHTML, key: squash(el.innerHTML), own: ownArabic(el) });
      return;
    }
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        if (/\S/.test(c.nodeValue)) units.push({ node: c, en: c.nodeValue, key: squash(c.nodeValue) });
      } else if (c.nodeType === 1) {
        collect(c);
      }
    }
  }
  function arabicFor(u) {
    if (has(AR, u.key)) return AR[u.key];
    return u.own || null;
  }
  function applyLang() {
    var ar = lang() === 'ar';
    units.forEach(function (u) {
      var v = ar ? arabicFor(u) : null;
      if (u.el) {
        var html = v == null ? u.en : v;
        if (u.el.innerHTML !== html) u.el.innerHTML = html;
      } else {
        var lead = u.en.match(/^\s*/)[0];
        var tail = u.en.match(/\s*$/)[0];
        u.node.nodeValue = v == null ? u.en : lead + v + tail;
      }
    });
    attrUnits.forEach(function (u) {
      u.el.setAttribute(u.attr, ar && has(AR, u.key) ? AR[u.key] : u.en);
    });
    if (titleUnit) document.title = ar && has(AR, titleUnit) ? AR[titleUnit] : titleUnit;
    langHooks.forEach(function (fn) { fn(); });
  }
  function setLang(next) {
    put('thara-lang', next);
    root.setAttribute('lang', next);
    root.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
    applyLang();
  }
  onLang(function () {
    var ar = lang() === 'ar';
    $$('[data-lang-toggle]').forEach(function (b) {
      b.textContent = ar ? 'En' : 'ع';
      b.setAttribute('lang', ar ? 'en' : 'ar');
      b.setAttribute('aria-label', ar ? 'English' : 'العربية');
      b.setAttribute('title', ar ? 'Read this page in English' : 'اقرأ الصفحة بالعربية');
    });
  });

  if (I18N) {
    collect(document.body);
    $$('[aria-label],[placeholder],[title],[alt]').forEach(function (el) {
      // Not the switch itself, nor anything written in Arabic already (its own
      // lang, not the page's).
      if (el.closest('[data-lang-toggle]') || el.getAttribute('lang') === 'ar') return;
      ['aria-label', 'placeholder', 'title', 'alt'].forEach(function (a) {
        if (el.hasAttribute(a)) attrUnits.push({ el: el, attr: a, en: el.getAttribute(a), key: squash(el.getAttribute(a)) });
      });
    });
    titleUnit = document.title;
    $$('[data-lang-toggle]').forEach(function (b) {
      b.hidden = false;
      b.addEventListener('click', function () { setLang(lang() === 'ar' ? 'en' : 'ar'); });
    });
    applyLang();

    // A link to a part of a page (privacy.html#feedback) is followed before
    // the Arabic changes the page's length: go there again once it is in.
    if (lang() === 'ar' && location.hash.length > 1) {
      var spot = document.getElementById(decodeURIComponent(location.hash.slice(1).split('?')[0]));
      if (spot) {
        // At once, not with the page's smooth scrolling.
        var jump = function () {
          root.style.scrollBehavior = 'auto';
          spot.scrollIntoView();
          root.style.scrollBehavior = '';
        };
        jump();
        window.addEventListener('load', jump, { once: true });
      }
    }

    // On a computer serving the site itself, ?i18n-dump lists what the page
    // would translate and what has no Arabic yet (for writing i18n/ar-*.js).
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]i18n-dump\b/.test(location.search)) {
      var seen = {};
      var report = { units: [], missing: [] };
      units.concat(attrUnits).forEach(function (u) {
        if (seen[u.key]) return;
        seen[u.key] = true;
        report.units.push(u.key);
        if (!has(AR, u.key) && !u.own && /[A-Za-z]/.test(u.key)) report.missing.push(u.key);
      });
      if (titleUnit && !has(AR, titleUnit)) report.missing.push(titleUnit);
      report.units.push(titleUnit);
      var pre = document.createElement('pre');
      pre.id = 'i18n-dump';
      pre.textContent = JSON.stringify(report, null, 1);
      document.body.textContent = '';
      document.body.appendChild(pre);
    }
  }
  root.classList.remove('i18n-wait');
  window.tharaI18n = { lang: lang, pick: pick, onLang: onLang };


  syncMotion();
  if (reduce.addEventListener) reduce.addEventListener('change', syncMotion);

  /* ---------- money: thousands commas, a true minus, dots when hidden ---------- */

  function fmt(n, sign) {
    var s = Math.round(Math.abs(n)).toLocaleString('en-US');
    var pre = sign === '+' ? '+' : sign === '-' ? '−' : '';
    return pre + 'E£' + s;
  }
  function hidden() { return root.getAttribute('data-hide') === '1'; }
  function paintMoney(el, value) {
    if (hidden()) { el.textContent = '•••'; return; }
    el.textContent = fmt(value == null ? +el.getAttribute('data-money') : value, el.getAttribute('data-sign'));
  }
  function paintAll() { $$('[data-money]').forEach(function (el) { if (!el._counting) paintMoney(el); }); }

  function count(el) {
    var to = +el.getAttribute('data-money');
    if (!moving() || hidden()) { paintMoney(el); return; }
    var t0 = null;
    var from = el._shown || 0;
    el._counting = true;
    function step(t) {
      if (t0 == null) t0 = t;
      var p = Math.min(1, (t - t0) / 1100);
      var e = 1 - Math.pow(1 - p, 3);
      if (hidden()) { el._counting = false; paintMoney(el); return; }
      paintMoney(el, from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else { el._counting = false; el._shown = to; }
    }
    requestAnimationFrame(step);
  }

  // Each setter saves only when the visitor chose (save), so a page that
  // merely shows the current state never rewrites a choice made elsewhere.
  function setHide(on, save) {
    if (on) root.setAttribute('data-hide', '1'); else root.removeAttribute('data-hide');
    if (save) put('thara-hide', on ? '1' : null);
    $$('[data-eye]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? pick('Show amounts', 'إظهار المبالغ') : pick('Hide amounts', 'إخفاء المبالغ'));
      var use = $('use', b);
      if (use) use.setAttribute('href', on ? '#i-eye-off' : '#i-eye');
    });
    $$('[data-switch="hide"]').forEach(function (s) { s.setAttribute('aria-checked', String(on)); });
    paintAll();
  }
  $$('[data-eye]').forEach(function (b) { b.addEventListener('click', function () { setHide(!hidden(), true); }); });
  onLang(function () { setHide(hidden()); });

  /* ---------- today's date where the app shows it ---------- */

  var now = new Date();
  var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var mons = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function paintDates() {
    var ar = lang() === 'ar';
    $$('[data-today]').forEach(function (el) {
      el.textContent = ar
        ? now.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }) + ' / ثراء'
        : days[now.getDay()] + ' ' + now.getDate() + ' ' + mons[now.getMonth()] + ' / THARA';
    });
    $$('[data-month]').forEach(function (el) {
      el.textContent = ar ? 'مصروف ' + now.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' }) : 'Spent in ' + months[now.getMonth()];
    });
  }
  paintDates();
  onLang(paintDates);

  /* ---------- entrance, figures and rings, as each comes into view ---------- */

  function ring(el) {
    if (!moving()) return;
    el.classList.remove('go');
    reflow(el);
    el.classList.add('go');
  }

  function arrive(el) {
    el.classList.add('in');
    $$('[data-count]', el).forEach(count);
    if (el.hasAttribute('data-count')) count(el);
    $$('.rings', el).forEach(ring);
  }

  var watched = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        arrive(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    watched.forEach(function (el) { io.observe(el); });
  } else {
    watched.forEach(arrive);
  }
  paintAll();

  // A press on a hero card sends a wave through its rings, as in the app.
  $$('.hero-card, .s-hero').forEach(function (card) {
    card.addEventListener('pointerdown', function () { $$('.rings', card).forEach(ring); });
  });

  // The mark turns once round when pressed.
  $$('.brand').forEach(function (b) {
    var turns = 0;
    b.addEventListener('click', function () {
      var g = $('.glyph', b);
      if (!g || !moving()) return;
      turns++;
      g.style.transform = 'rotate(' + (turns * 360) + 'deg)';
    });
  });

  /* ---------- appearance pop-up: grows from its button ---------- */

  var pop = $('#appearance');
  var popBtn = $('[data-pop="appearance"]');

  function setTheme(v, save) {
    if (v === 'light' || v === 'dark') root.setAttribute('data-theme', v);
    else root.removeAttribute('data-theme');
    if (save) put('thara-theme', v === 'light' || v === 'dark' ? v : null);
    $$('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === (v || 'auto')));
    });
  }
  function setMotion(on, save) {
    if (on) root.removeAttribute('data-motion'); else root.setAttribute('data-motion', 'off');
    if (save) put('thara-motion', on ? null : 'off');
    $$('[data-switch="motion"]').forEach(function (s) { s.setAttribute('aria-checked', String(on)); });
    syncMotion();
  }
  $$('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set'), true); });
  });
  $$('[data-switch]').forEach(function (s) {
    s.addEventListener('click', function () {
      var on = s.getAttribute('aria-checked') !== 'true';
      if (s.getAttribute('data-switch') === 'hide') setHide(on, true);
      else setMotion(on, true);
    });
  });
  setTheme(root.getAttribute('data-theme') || 'auto');
  setHide(hidden());
  setMotion(root.getAttribute('data-motion') !== 'off');

  function openPop() {
    if (!pop) return;
    pop.hidden = false;
    reflow(pop);
    pop.classList.add('open');
    popBtn.setAttribute('aria-expanded', 'true');
    var first = $('[aria-pressed="true"], button', pop);
    if (first) first.focus();
  }
  function closePop(back) {
    if (!pop || pop.hidden) return;
    pop.classList.remove('open');
    popBtn.setAttribute('aria-expanded', 'false');
    later(function () { if (!pop.classList.contains('open')) pop.hidden = true; });
    if (back) popBtn.focus();
  }
  if (popBtn && pop) {
    popBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pop.classList.contains('open')) closePop(true); else openPop();
    });
    document.addEventListener('click', function (e) {
      if (pop.classList.contains('open') && !pop.contains(e.target)) closePop(false);
    });
    pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(true); });
  }

  /* ---------- the bottom bar follows the page ---------- */

  var slots = $$('.dock a[data-spy]');
  if (slots.length && 'IntersectionObserver' in window) {
    var mark = function (id) {
      slots.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('data-spy') === id)); });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.getAttribute('data-section')); });
    }, { rootMargin: '-42% 0px -52% 0px' });
    $$('[data-section]').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- a fold that a link points at opens ---------- */

  function reveal() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var fold = el.tagName === 'DETAILS' ? el : el.closest && el.closest('details');
    if (fold && !fold.open) fold.open = true;
  }
  window.addEventListener('hashchange', reveal);
  reveal();

  /* ---------- feature chips filter the groups, like Records ---------- */

  var chips = $$('[data-filter]');
  chips.forEach(function (c) {
    c.addEventListener('click', function () { filter(c.getAttribute('data-filter')); });
  });
  function filter(which) {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === which)); });
    $$('[data-group]').forEach(function (g) {
      var show = which === 'all' || g.getAttribute('data-group') === which;
      g.classList.toggle('gone', !show);
      g.classList.remove('enter');
      if (show) { reflow(g); g.classList.add('enter'); }
    });
  }

  /* ---------- focus kept inside whatever is open ---------- */

  function focusables(el) {
    return $$('a[href], button:not([disabled]), input, [tabindex="0"]', el).filter(function (n) {
      return !n.hidden && n.offsetParent !== null;
    });
  }
  function trap(el, e) {
    if (e.key !== 'Tab') return;
    var f = focusables(el);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- the + : a dome grows and the places fan out ---------- */

  var plus = $('#plus');
  var arc = $('#arc');

  function place() {
    var r = plus.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var k = Math.max(.66, Math.min(1, (Math.min(innerWidth, 560) / 2 - 44) / 156));
    var rtl = root.dir === 'rtl' ? -1 : 1;
    arc.style.setProperty('--cx', cx + 'px');
    arc.style.setProperty('--cy', cy + 'px');
    arc.style.setProperty('--R', Math.round(274 * k) + 'px');
    arc.style.setProperty('--drop', Math.round(41 * k) + 'px');
    $$('.arc-item', arc).forEach(function (it, i) {
      var a = +it.getAttribute('data-a') * Math.PI / 180;
      var d = (it.getAttribute('data-ring') === 'in' ? 108 : 216) * k;
      var px = cx + Math.cos(a) * d * rtl;
      var py = cy - Math.sin(a) * d;
      it.style.setProperty('--px', px + 'px');
      it.style.setProperty('--py', py + 'px');
      it.style.setProperty('--fx', (cx - px) + 'px');
      it.style.setProperty('--fy', (cy - py) + 'px');
      it.style.setProperty('--k', String(i));
    });
  }
  function openArc() {
    closePop(false);
    place();
    arc.hidden = false;
    reflow(arc);
    arc.classList.add('open');
    plus.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var first = $('.arc-item', arc);
    if (first) first.focus({ preventScroll: true });
  }
  function closeArc(back) {
    if (!arc || arc.hidden) return;
    arc.classList.remove('open');
    plus.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    later(function () { if (!arc.classList.contains('open')) arc.hidden = true; });
    if (back) plus.focus({ preventScroll: true });
  }
  if (plus && arc) {
    plus.addEventListener('click', function () { if (arc.hidden) openArc(); else closeArc(true); });
    $('.arc-scrim', arc).addEventListener('click', function () { closeArc(true); });
    $('.arc-close', arc).addEventListener('click', function () { closeArc(true); });
    arc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeArc(true); return; }
      var items = $$('.arc-item', arc);
      var i = items.indexOf(document.activeElement);
      if (i >= 0 && /^Arrow/.test(e.key)) {
        e.preventDefault();
        var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        if (root.dir === 'rtl' && /Left|Right/.test(e.key)) step = -step;
        items[(i + step + items.length) % items.length].focus();
      }
      trap(arc, e);
    });
    $$('.arc-item', arc).forEach(function (it) {
      it.addEventListener('click', function (e) {
        if (it.hasAttribute('data-open')) {
          e.preventDefault();
          closeArc(false);
          openSheet(it.getAttribute('data-open'));
          return;
        }
        closeArc(false);
        var id = (it.getAttribute('href') || '').replace(/^#/, '');
        var target = id && document.getElementById(id);
        if (target && target.tagName === 'DETAILS') target.open = true;
      });
    });
    window.addEventListener('resize', function () { if (!arc.hidden) place(); });
  }

  /* ---------- sheets: the hub's "find anything" ---------- */

  var lastFocus = null;
  function openSheet(id) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    lastFocus = document.activeElement;
    wrap.hidden = false;
    reflow(wrap);
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
    var input = $('input', wrap);
    setTimeout(function () { (input || $('button', wrap)).focus({ preventScroll: true }); }, moving() ? 120 : 0);
  }
  function closeSheet(wrap, back) {
    if (!wrap || wrap.hidden) return;
    wrap.classList.remove('open');
    document.body.style.overflow = '';
    later(function () { if (!wrap.classList.contains('open')) wrap.hidden = true; });
    if (back !== false) {
      var to = lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null ? lastFocus : plus;
      if (to) to.focus({ preventScroll: true });
    }
  }
  $$('.sheet-wrap').forEach(function (wrap) {
    $$('[data-close]', wrap).forEach(function (b) { b.addEventListener('click', function () { closeSheet(wrap); }); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet(wrap);
      trap(wrap, e);
    });
  });
  $$('[data-sheet]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openSheet(b.getAttribute('data-sheet')); });
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing && $('#hub') && $('#hub').hidden) { e.preventDefault(); openSheet('hub'); }
    if (e.key === 'Escape') closePop(true);
  });

  // Going somewhere from a sheet: close it, open the fold or group the
  // place sits in, bring it into view and light it up once.
  function go(target) {
    var hub = $('#hub');
    closeSheet(hub, false);
    var group = target.closest && target.closest('[data-group]');
    if (group && group.classList.contains('gone')) filter('all');
    var fold = target.tagName === 'DETAILS' ? target : target.closest && target.closest('details');
    if (fold) fold.open = true;
    setTimeout(function () {
      target.scrollIntoView({ behavior: moving() ? 'smooth' : 'auto', block: 'center' });
      target.classList.remove('flash');
      reflow(target);
      target.classList.add('flash');
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|SUMMARY|DETAILS)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      var f = target.tagName === 'DETAILS' ? $('summary', target) : target;
      f.focus({ preventScroll: true });
    }, moving() ? 200 : 0);
  }
  $$('#hub [data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById(a.getAttribute('data-go'));
      if (!t) return;
      e.preventDefault();
      go(t);
    });
  });

  // Search over what the page says, in English and Arabic.
  var findInput = $('#find');
  var results = $('#results');
  var placesBox = $('#hub-places');
  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/[ً-ْـ]/g, '')
      .replace(/[آأإ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }
  // Made at each search, in the page's language: the title in it, the
  // other language's beside it, and either may be searched.
  function buildIndex() {
    var ar = lang() === 'ar';
    return $$('[data-find]').map(function (el) {
      var en = el.getAttribute('data-find');
      // A feature's own Arabic name sits beside it in English; in Arabic it
      // is the name itself.
      var arTitle = el.getAttribute('data-find-ar') || (has(AR, en) ? AR[en] : '') ||
        (ar ? ($('b', el) || {}).textContent : ($('.ar', el) || {}).textContent) || '';
      var lineEn = el.getAttribute('data-find-line') || '';
      var line = lineEn ? (ar && has(AR, lineEn) ? AR[lineEn] : lineEn) : (($('.t > span:not(.ar)', el) || $('.v', el) || {}).textContent || '');
      var icon = $('.tile', el);
      return {
        el: el,
        title: (ar && arTitle ? arTitle : en).trim(),
        other: (ar ? (arTitle ? en : '') : arTitle).trim(),
        otherLang: ar ? 'en' : 'ar',
        line: line.trim(),
        icon: icon ? icon.innerHTML : '',
        hay: norm(en + ' ' + arTitle + ' ' + line + ' ' + lineEn),
      };
    });
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hilite(s, q) {
    // Marks are placed by position, so only where folding kept every letter.
    if (!q || norm(s).length !== s.length) return esc(s);
    var i = norm(s).indexOf(q);
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
  }
  function search() {
    var q = norm(findInput.value.trim());
    if (!q) { results.hidden = true; placesBox.hidden = false; return; }
    var words = q.split(/\s+/);
    var hits = buildIndex().filter(function (x) { return words.every(function (w) { return x.hay.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return (norm(a.title).indexOf(q) === 0 ? 0 : 1) - (norm(b.title).indexOf(q) === 0 ? 0 : 1); })
      .slice(0, 12);
    placesBox.hidden = true;
    results.hidden = false;
    if (!hits.length) {
      results.innerHTML = '<p class="empty">' + pick('Nothing here matches “' + esc(findInput.value.trim()) + '”. Try another word, in English or Arabic.',
        'لا شيء هنا يطابق «' + esc(findInput.value.trim()) + '». جرّب كلمة أخرى، بالعربية أو بالإنجليزية.') + '</p>';
      return;
    }
    results.innerHTML = '<div class="list">' + hits.map(function (h, i) {
      var line = h.line.length > 110 ? h.line.slice(0, 108).replace(/\s+\S*$/, '') + '…' : h.line;
      return '<button class="row" type="button" data-hit="' + i + '">' +
        '<span class="tile">' + (h.icon || '<svg class="i"><use href="#i-dot"/></svg>') + '</span>' +
        '<span class="t"><b>' + hilite(h.title, q) + (h.other ? ' <span class="ar" lang="' + h.otherLang + '">' + hilite(h.other, q) + '</span>' : '') + '</b>' +
        (line ? '<span>' + esc(line) + '</span>' : '') + '</span>' +
        '<svg class="i chev flip" aria-hidden="true"><use href="#i-next"/></svg></button>';
    }).join('') + '</div>';
    $$('[data-hit]', results).forEach(function (b) {
      b.addEventListener('click', function () { go(hits[+b.getAttribute('data-hit')].el); });
    });
  }
  if (findInput) {
    findInput.addEventListener('input', search);
    onLang(function () { if (findInput.value.trim()) search(); });
  }

  /* ---------- build number, date and download sizes ----------
     version.json is published by the same CI run that produces the
     downloads, and it is the file the app reads to decide whether an
     update exists, so the page and the app can never disagree. Purely
     additive: with no network the static text stays and every link works. */

  function fill(selector, value) { $$(selector).forEach(function (el) { el.textContent = value; }); }
  function on(date) {
    return new Date(date).toLocaleDateString(pick('en-GB', 'ar-EG-u-nu-latn'), { day: 'numeric', month: 'short', year: 'numeric' });
  }
  var NOTES_AR = {
    'for almost every phone (64-bit)': 'لمعظم الهواتف (64 بت)',
    'for older 32-bit phones': 'للهواتف الأقدم (32 بت)',
    'works on every phone, about twice the size': 'يعمل على كل هاتف، وحجمه نحو الضعف',
  };
  // Before version.json answers (or with no network), the page's own text
  // stays, in Arabic when there is Arabic for it.
  function size(name, bytes, date) {
    $$('[data-asset="' + name + '"]').forEach(function (el) {
      if (el._static == null) el._static = el.textContent;
      if (!bytes) {
        el.textContent = lang() === 'ar' && has(AR, squash(el._static)) ? AR[squash(el._static)] : el._static;
        return;
      }
      var note = el.getAttribute('data-note');
      var said = note ? pick(note, NOTES_AR[note] || note) : pick('built ', 'بُني ') + on(date);
      el.textContent = (bytes / 1048576).toFixed(0) + pick(' MB · ', ' ميجابايت · ') + said;
    });
  }
  var version = null;
  function paintVersion() {
    var v = version || {};
    if (v.buildNumber) fill('[data-version-build]', v.buildNumber);
    if (v.publishedAt) fill('[data-version-date]', pick('built ', 'بُني ') + on(v.publishedAt));
    var apks = v.androidApks || {};
    size('thara-release-arm64-v8a.apk', apks['arm64-v8a'] && apks['arm64-v8a'].sizeBytes, v.publishedAt);
    size('thara-release-armeabi-v7a.apk', apks['armeabi-v7a'] && apks['armeabi-v7a'].sizeBytes, v.publishedAt);
    size('thara-release.apk', v.sizeBytes, v.publishedAt);
  }
  paintVersion();
  onLang(paintVersion);
  if (window.fetch && location.protocol !== 'file:') {
    fetch('version.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (v) {
        version = v;
        paintVersion();
      })
      .catch(function () { /* Keep the static text. */ });

    // (The feedback form, below, talks to Thara's gateway.)
    // The GitHub API is asked only for what the manifest does not carry
    // (the iPhone file, when its card is back). Anonymous calls are rate
    // limited per IP, so nothing important depends on it.
    if ($('[data-asset="thara-unsigned.ipa"]')) {
      fetch('https://api.github.com/repos/dvahasan/thara-site/releases/tags/apk-latest', { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (release) {
          (release.assets || []).forEach(function (a) { if (a.name === 'thara-unsigned.ipa') size(a.name, a.size, a.updated_at); });
        })
        .catch(function () { /* Keep the static text. */ });
    }
  }
  /* ---------- Thara's gateway: the feedback form, and the inbox page ---------- */

  // The website calls one path of Thara's gateway, /v1/feedback, which
  // answers only Thara's own pages. On a computer serving the site itself
  // (localhost), a gateway running there is used instead.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var GATEWAY = LOCAL ? 'http://127.0.0.1:8797' : 'https://thara-gateway.thara-app.workers.dev';

  // A random id for this browser, as the app has one per install: the
  // gateway counts a day's messages by it (and forgets the count after two
  // days). It says nothing about the visitor.
  function siteId() {
    var id = get('thara-site-id');
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
    var bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    id = btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    put('thara-site-id', id);
    return id;
  }

  /** One request to /v1/feedback: resolves `{ status, body }`; rejects
   * only when the gateway could not be reached at all. */
  function gatewayAsk(body) {
    return fetch(GATEWAY + '/v1/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-thara-install': siteId() },
      body: JSON.stringify(body),
      cache: 'no-store',
    }).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (e) { parsed = null; }
        return { status: r.status, body: parsed };
      });
    });
  }

  function reasonOf(answer) {
    return answer && answer.body && answer.body.error ? answer.body.error.reason : null;
  }

  // For the inbox page (inbox.js), which loads this file first.
  window.tharaGateway = { ask: gatewayAsk, reason: reasonOf, url: GATEWAY };

  // Download presses, counted once per browser: the gateway keeps one
  // record per browser id, made the first time, and this browser remembers
  // it was counted so that pressing again sends nothing at all.
  var APK_FILES = {
    'thara-release-arm64-v8a.apk': 'arm64',
    'thara-release-armeabi-v7a.apk': 'armv7',
    'thara-release.apk': 'universal',
  };
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href*="/releases/download/"]') : null;
    if (!link || !window.fetch || !window.crypto || !crypto.getRandomValues) return;
    var file = APK_FILES[link.getAttribute('href').split('/').pop()];
    if (!file || get('thara-download-counted') === '1') return;
    put('thara-download-counted', '1');
    try {
      fetch(GATEWAY + '/v1/feedback', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json', 'x-thara-install': siteId() },
        body: JSON.stringify({ op: 'download', file: file }),
      }).then(function (r) {
        // Not counted (the gateway was unreachable or busy): tried again on
        // the next press.
        if (!r.ok && r.status !== 429) put('thara-download-counted', null);
      }, function () { put('thara-download-counted', null); });
    } catch (err) {
      put('thara-download-counted', null);
    }
  });

  var form = $('#fb-form');
  if (form && window.fetch && window.crypto && crypto.getRandomValues) {
    var text = $('#fb-text');
    var tally = $('#fb-count');
    var status = $('#fb-status');
    var done = $('#fb-done');
    var send = form.querySelector('button[type="submit"]');
    var ARABIC = /[\u0600-\u06FF]/;

    var counted = function () { tally.textContent = text.value.length + ' / 2000'; };
    text.addEventListener('input', function () {
      counted();
      if (text.value.trim().length >= 3) text.removeAttribute('aria-invalid');
    });
    counted();

    var say = function (words, bad) {
      status.textContent = words;
      status.classList.toggle('bad', !!bad);
    };

    // The app opens the form as #feedback?build=252&phone=Galaxy%20A54: the
    // part after "#" never leaves the browser, so nothing is sent with it.
    var fromApp = function () {
      var h = location.hash;
      if (h.indexOf('#feedback?') !== 0) return;
      var params = {};
      h.slice('#feedback?'.length).split('&').forEach(function (pair) {
        var at = pair.indexOf('=');
        if (at > 0) {
          try { params[decodeURIComponent(pair.slice(0, at))] = decodeURIComponent(pair.slice(at + 1)); } catch (e) { /* skip */ }
        }
      });
      if (/^[0-9]{1,6}$/.test(params.build || '')) form.build.value = params.build;
      if (params.phone && params.phone.length <= 60) form.phone.value = params.phone;
      var section = $('#feedback');
      if (section) section.scrollIntoView({ block: 'start' });
    };
    fromApp();
    window.addEventListener('hashchange', fromApp);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var words = text.value.trim();
      if (words.length < 3) {
        text.setAttribute('aria-invalid', 'true');
        say(pick('Write a few words about what happened first.', 'اكتب بضع كلمات عمّا حدث أولًا.'), true);
        text.focus();
        return;
      }
      var contact = form.contact.value.trim();
      if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        form.contact.setAttribute('aria-invalid', 'true');
        say(pick('That email does not look right. Leave it empty if you prefer.', 'هذا البريد لا يبدو صحيحًا. اتركه فارغًا إن شئت.'), true);
        form.contact.focus();
        return;
      }
      form.contact.removeAttribute('aria-invalid');
      var build = form.build.value.trim();
      if (build && !/^[0-9]{1,6}$/.test(build)) {
        form.build.setAttribute('aria-invalid', 'true');
        say(pick('The build is a number, like 252. Leave it empty if you are not sure.', 'رقم الإصدار رقمٌ مثل 252. اتركه فارغًا إن لم تكن متأكدًا.'), true);
        form.build.focus();
        return;
      }
      form.build.removeAttribute('aria-invalid');
      var kind = form.querySelector('input[name="kind"]:checked');
      var body = {
        op: 'send',
        text: words,
        kind: kind ? kind.value : 'other',
        lang: ARABIC.test(words) ? 'ar' : 'en',
        trap: form.trap.value,
      };
      if (contact) body.contact = contact;
      if (build) body.build = Number(build);
      if (form.phone.value.trim()) body.phone = form.phone.value.trim();

      send.disabled = true;
      say(pick('Sending…', 'جارٍ الإرسال…'));
      gatewayAsk(body).then(function (answer) {
        send.disabled = false;
        if (answer.status === 200) {
          // A next message is likely about the same phone: those stay.
          var sameBuild = form.build.value;
          var samePhone = form.phone.value;
          form.reset();
          form.build.value = sameBuild;
          form.phone.value = samePhone;
          counted();
          say('');
          form.hidden = true;
          done.hidden = false;
          done.querySelector('button').focus();
          return;
        }
        var reason = reasonOf(answer);
        if (reason === 'install_day' || reason === 'global_day') say(pick('That is enough messages from here for today. Thank you — try again tomorrow.', 'يكفي هذا من هنا لليوم. شكرًا لك، وجرّب غدًا.'), true);
        else if (reason === 'minute') say(pick('A moment, please: too many at once. Try again in a minute.', 'لحظة من فضلك: رسائل كثيرة في وقت واحد. جرّب بعد دقيقة.'), true);
        else if (answer.status === 400) say(pick('That message could not be taken as it is. Shorten it, or take out unusual characters.', 'تعذّر قبول الرسالة كما هي. اختصرها، أو احذف الرموز غير المعتادة.'), true);
        else say(pick('Feedback cannot be taken just now. Try again in a little while.', 'لا يمكن استقبال الملاحظات الآن. جرّب بعد قليل.'), true);
      }, function () {
        send.disabled = false;
        say(pick('Thara\'s server could not be reached. Check your connection and try again.', 'تعذّر الوصول إلى خادم ثراء. تحقّق من اتصالك وحاول مرة أخرى.'), true);
      });
    });

    $('#fb-again').addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      text.focus();
    });
  }
  /* ---------- the survey asks for itself ---------- */

  // A few seconds after the home page opens, unless this browser answered
  // the survey (survey.js keeps thara-survey-done) or said "Not now" to
  // this card in the last week. It takes no focus; Escape inside it, the
  // close button or "Not now" put it away.
  var surveyPop = document.getElementById('survey-pop');
  var spWeek = 7 * 24 * 60 * 60 * 1000;
  if (surveyPop && get('thara-survey-done') !== '1' && !(Date.now() - (Number(get('thara-survey-later')) || 0) < spWeek)) {
    var spLater = function () {
      put('thara-survey-later', String(Date.now()));
      surveyPop.hidden = true;
    };
    Array.prototype.forEach.call(surveyPop.querySelectorAll('[data-sp-later]'), function (b) { b.addEventListener('click', spLater); });
    surveyPop.addEventListener('keydown', function (e) { if (e.key === 'Escape') spLater(); });
    surveyPop.querySelector('[data-sp-go]').addEventListener('click', function () { put('thara-survey-later', String(Date.now())); });
    setTimeout(function () { surveyPop.hidden = false; }, 2500);
  }
})();
