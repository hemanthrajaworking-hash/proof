/* UI only. Files are read in memory; no fetch/XHR, no storage. */
(function () {
  'use strict';
  var A = window.AmazonLost, $ = function (id) { return document.getElementById(id); }, last = null;
  function readFile(input) { return new Promise(function (ok, bad) { var f = input.files[0]; if (!f) return ok(''); var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = bad; r.readAsText(f); }); }
  function money(v) { return v == null || isNaN(v) ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function td(t, c) { var e = document.createElement('td'); e.textContent = t; if (c) e.className = c; return e; }
  function run(files) {
    $('msg').textContent = ''; if (!files.settlement) { $('msg').textContent = 'Please choose a settlement report, or try the sample files.'; return; }
    try { last = A.analyze(files, { defaultUnitCost: +$('unitCost').value || 0, refundGraceDays: +$('grace').value || 45 }); } catch (e) { $('msg').textContent = e.message; return; }
    var k = $('kpis'); k.textContent = '';
    [['Total possible', last.totalPossible], ['Lost / damaged stock', last.byType.LOST_OR_DAMAGED_NOT_REIMBURSED], ['Refunds without return', last.byType.REFUND_WITHOUT_RETURN], ['Refund commission', last.byType.REFUND_COMMISSION_NOT_RETURNED], ['FBA fees above usual', last.byType.FBA_FEE_ABOVE_USUAL]].forEach(function (x) {
      var d = document.createElement('div'); d.className = 'kpi'; d.textContent = x[0]; var e = document.createElement('b'); e.textContent = money(x[1] || 0); d.appendChild(e); k.appendChild(d); });
    var tb = $('tbody'); tb.textContent = '';
    if (!last.items.length) { var tr0 = document.createElement('tr'), c0 = td('Nothing flagged with these settings.'); c0.colSpan = 5; tr0.appendChild(c0); tb.appendChild(tr0); }
    last.items.forEach(function (x) { var tr = document.createElement('tr'); [td(x.ref), td(x.type.replace(/_/g, ' ').toLowerCase()), td(money(x.amount), 'n'), td(money(x.recoverable), 'n'), td(x.reason)].forEach(function (c) { tr.appendChild(c); }); tb.appendChild(tr); });
    $('feePct').textContent = last.feePct; $('feeEst').textContent = 'If every item here were recovered, the fee would be ' + money(last.feeIfAllRecovered) + '.';
    $('results').hidden = false;
  }
  $('run').addEventListener('click', function () { Promise.all([$('fSettlement'), $('fReimb'), $('fAdj'), $('fReturns')].map(readFile)).then(function (a) { run({ settlement: a[0], reimbursements: a[1], adjustments: a[2], returns: a[3] }); }, function () { $('msg').textContent = 'Could not read a file.'; }); });
  $('sample').addEventListener('click', function () { $('unitCost').value = 0; $('grace').value = 45; run(window.AMZ_SAMPLES); });
  $('dl').addEventListener('click', function () { if (!last) return; var u = URL.createObjectURL(new Blob([A.toCSV(last.items)], { type: 'text/csv' })); var a = document.createElement('a'); a.href = u; a.download = 'amazon_lost_money_findings.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); });
})();
