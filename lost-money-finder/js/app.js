/* UI only. Files are read in memory; no fetch/XHR, no storage. */
(function () {
  'use strict';
  var R = window.PayoutRecon, L = window.LostMoney, $ = function (id) { return document.getElementById(id); }, last = null;
  Object.keys(L.RATE_TABLE).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = L.RATE_TABLE[k].label; $('plan').appendChild(o); });
  function setRate() { var r = L.RATE_TABLE[$('plan').value]; $('pct').value = r.pct; $('fixed').value = r.fixed.toFixed(2); }
  $('plan').addEventListener('change', setRate); setRate();
  function readFile(input, optional) { return new Promise(function (ok, bad) { var f = input.files[0]; if (!f) return optional ? ok('') : bad(new Error('missing')); var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = bad; r.readAsText(f); }); }
  function money(v) { return v === null || v === undefined || isNaN(v) ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function td(t, c) { var e = document.createElement('td'); e.textContent = t; if (c) e.className = c; return e; }
  function run(p, b) {
    $('msg').textContent = ''; var P = R.parseCSV(p); if (!P.length) { $('msg').textContent = 'The payouts file has no rows.'; return; }
    last = L.find(R, P, R.parseCSV(b || ''), { rate: { pct: +$('pct').value || 0, fixed: +$('fixed').value || 0 }, feeTol: +$('feeTol').value || 0, match: { dayFirst: $('dayFirst').checked } });
    var k = $('kpis'); k.textContent = '';
    [['Total possible', last.totalPossible], ['Missing deposits', last.byType.MISSING_DEPOSIT], ['Short deposits', last.byType.SHORT_DEPOSIT], ['Chargebacks / adjustments', last.byType.CHARGEBACK_OR_ADJUSTMENT], ['Fees above estimate', last.byType.FEES_ABOVE_ESTIMATE]].forEach(function (x) { var d = document.createElement('div'); d.className = 'kpi'; d.textContent = x[0]; var e = document.createElement('b'); e.textContent = money(x[1] || 0); d.appendChild(e); k.appendChild(d); });
    var tb = $('tbody'); tb.textContent = '';
    if (!last.items.length) { var tr0 = document.createElement('tr'); var c0 = td('Nothing flagged with these settings.'); c0.colSpan = 6; tr0.appendChild(c0); tb.appendChild(tr0); }
    last.items.forEach(function (x) { var tr = document.createElement('tr'); [td(x.payout_id), td(x.date), td(x.type.replace(/_/g, ' ').toLowerCase()), td(money(x.amount), 'n'), td(money(x.recoverable), 'n'), td(x.reason)].forEach(function (c) { tr.appendChild(c); }); tb.appendChild(tr); });
    $('results').hidden = false;
  }
  $('run').addEventListener('click', function () { Promise.all([readFile($('fPayouts')), readFile($('fBank'), true)]).then(function (a) { run(a[0], a[1]); }, function () { $('msg').textContent = 'Please choose a payouts CSV, or try the sample data.'; }); });
  $('sample').addEventListener('click', function () { $('plan').value = 'basic'; setRate(); $('dayFirst').checked = false; run(window.LOST_SAMPLES.payouts, window.LOST_SAMPLES.bank); });
  $('dl').addEventListener('click', function () { if (!last) return; var u = URL.createObjectURL(new Blob([L.toCSV(last.items)], { type: 'text/csv' })); var a = document.createElement('a'); a.href = u; a.download = 'lost_money_findings.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); });
})();
