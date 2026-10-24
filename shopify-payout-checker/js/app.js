/* UI only. Reads files with FileReader in memory; no fetch/XHR, no storage. */
(function () {
  'use strict';
  var R = window.PayoutRecon, $ = function (id) { return document.getElementById(id); }, last = null;
  function readFile(input) { return new Promise(function (ok, bad) { var f = input.files[0]; if (!f) return bad(new Error('missing')); var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = bad; r.readAsText(f); }); }
  function money(v) { return v === null || v === undefined || v === '' || isNaN(v) ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function td(text, cls) { var c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; return c; }
  function render() {
    var t = last.totals, k = $('kpis'); k.textContent = '';
    [['Payouts', t.payouts], ['Matched', t.matched + t.tolerance], ['Partial', t.partial], ['Missing deposits', t.missing], ['Deposits with no payout', t.extra], ['Gross sales', money(t.gross)], ['Fees', money(t.fees)], ['Refunds', money(t.refunds)], ['Adjustments / chargebacks', money(t.adjustments)], ['Expected in bank', money(t.expected)], ['Received (matched)', money(t.received)], ['Gap', money(t.gap)]].forEach(function (x) { var d = document.createElement('div'); d.className = 'kpi'; d.textContent = x[0]; var b = document.createElement('b'); b.textContent = x[1]; d.appendChild(b); k.appendChild(d); });
    var w = $('warnings'); w.textContent = ''; last.warnings.forEach(function (m) { var li = document.createElement('li'); li.textContent = m; w.appendChild(li); });
    var tb = $('tbody'); tb.textContent = ''; var only = $('onlyExc').checked;
    last.rows.forEach(function (r) { if (only && /^MATCHED/.test(r.status)) return; var tr = document.createElement('tr');
      [td(r.payout_id), td(r.payout_date), td(money(r.payout_total), 'n'), td(money(r.fees), 'n'), td(money(r.refunds), 'n'), td(money(r.adjustments), 'n'), td(r.bank_date), td(money(r.bank_amount), 'n'), td(money(r.difference), 'n'), td(r.status.replace(/_/g, ' ').toLowerCase(), 's-' + r.status), td(r.next_step)].forEach(function (c) { tr.appendChild(c); }); tb.appendChild(tr); });
    $('results').hidden = false;
  }
  function run(pText, bText) {
    $('msg').textContent = '';
    var P = R.parseCSV(pText), B = R.parseCSV(bText);
    if (!P.length || !B.length) { $('msg').textContent = 'One of the files has no rows.'; return; }
    last = R.reconcile(P, B, { amountTol: +$('tol').value || 0, windowAfter: +$('win').value || 0, partialPct: (+$('pct').value || 0) / 100, dayFirst: $('dayFirst').checked });
    render();
  }
  $('run').addEventListener('click', function () { Promise.all([readFile($('fPayouts')), readFile($('fBank'))]).then(function (a) { run(a[0], a[1]); }, function () { $('msg').textContent = 'Please choose both CSV files, or try the sample data.'; }); });
  $('sample').addEventListener('click', function () { $('dayFirst').checked = false; run(window.PAYOUT_SAMPLES.payouts, window.PAYOUT_SAMPLES.bank); });
  $('onlyExc').addEventListener('change', function () { if (last) render(); });
  $('dl').addEventListener('click', function () { if (!last) return; var url = URL.createObjectURL(new Blob([R.toCSV(last.rows)], { type: 'text/csv' })); var a = document.createElement('a'); a.href = url; a.download = 'payout_check_result.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); });
})();
