/* The Thara survey: one answer per browser, sent to Thara's gateway
   (/v1/feedback, op "survey"), which keeps it under a hash of this
   browser's random id and replaces it if the same browser answers again.
   Questions 2 to 4 are about using Thara, so they are hidden for someone
   who has not used it yet. */
(function () {
  'use strict';

  var gw = window.tharaGateway;
  var form = document.getElementById('sv-form');
  if (!gw || !form) return;

  var status = document.getElementById('sv-status');
  var done = document.getElementById('sv-done');
  var before = document.getElementById('sv-before');
  // The page's language (site.js): every message is written in both.
  var i18n = window.tharaI18n || { pick: function (en) { return en; } };
  var pick = i18n.pick;

  function kept(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function keep(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } }

  if (kept('thara-survey-done') === '1') before.hidden = false;

  function say(words, bad) {
    status.textContent = words || '';
    status.classList.toggle('bad', !!bad);
  }

  function value(name) {
    var chosen = form.querySelector('input[name="' + name + '"]:checked');
    return chosen ? chosen.value : '';
  }

  // Questions about using Thara step aside for someone who has not yet.
  function usedChanged() {
    var notYet = value('used') === 'not_yet';
    Array.prototype.forEach.call(form.querySelectorAll('[data-if-used]'), function (q) {
      q.hidden = notYet;
    });
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'used') usedChanged();
    var q = e.target.closest('.sv-q');
    if (q) q.classList.remove('missing');
  });
  usedChanged();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var missing = Array.prototype.filter.call(form.querySelectorAll('[data-required]'), function (q) {
      return !value(q.getAttribute('data-q'));
    });
    Array.prototype.forEach.call(form.querySelectorAll('.sv-q.missing'), function (q) { q.classList.remove('missing'); });
    if (missing.length) {
      missing.forEach(function (q) { q.classList.add('missing'); });
      say(pick('Please answer questions 1, 5 and 6 — the rest are up to you.', 'أجب عن الأسئلة 1 و5 و6 من فضلك، والباقي اختياري.'), true);
      missing[0].scrollIntoView({ block: 'center' });
      var first = missing[0].querySelector('input');
      if (first) first.focus({ preventScroll: true });
      return;
    }

    var notYet = value('used') === 'not_yet';
    var body = { op: 'survey', used: value('used'), useful: value('useful'), pay: value('pay') };
    ['recommend', 'lang'].forEach(function (name) { if (value(name)) body[name] = value(name); });
    if (!notYet) {
      if (value('freq')) body.freq = value('freq');
      if (value('add')) body.add = value('add');
      var features = Array.prototype.map.call(form.querySelectorAll('input[name="features"]:checked'), function (c) { return c.value; });
      if (features.length) body.features = features;
    }
    ['see', 'ideas', 'payNote'].forEach(function (name) {
      var text = form.elements[name].value.trim();
      if (text) body[name] = text;
    });

    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    say(pick('Sending…', 'جارٍ الإرسال…'));
    gw.ask(body).then(function (answer) {
      button.disabled = false;
      if (answer.status === 200) {
        keep('thara-survey-done', '1');
        form.hidden = true;
        before.hidden = true;
        document.getElementById('sv-done-text').textContent = answer.body && answer.body.again
          ? pick('Your new answers replaced the ones you sent before.', 'حلّت إجاباتك الجديدة محل التي أرسلتها من قبل.')
          : pick('Your answers are with the developer now.', 'وصلت إجاباتك إلى المطوّر.');
        done.hidden = false;
        done.scrollIntoView({ block: 'start' });
        return;
      }
      var reason = gw.reason(answer);
      if (reason === 'install_day' || reason === 'global_day' || reason === 'minute') say(pick('Too many answers from here just now. Try again later.', 'إجابات كثيرة من هنا الآن. جرّب لاحقًا.'), true);
      else if (answer.status === 400) say(pick('Something in the answers could not be taken. Shorten the written answers and try again.', 'تعذّر قبول شيء في الإجابات. اختصر الإجابات المكتوبة وحاول مرة أخرى.'), true);
      else say(pick('The answers cannot be taken just now. Try again in a little while.', 'لا يمكن استقبال الإجابات الآن. جرّب بعد قليل.'), true);
    }, function () {
      button.disabled = false;
      say(pick('Thara\'s server could not be reached. Check your connection and try again.', 'تعذّر الوصول إلى خادم ثراء. تحقّق من اتصالك وحاول مرة أخرى.'), true);
    });
  });
})();
