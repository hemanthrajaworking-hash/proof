/* Amazon lost-money finder core. Browser-only: no network, no storage. Every amount is an estimate to check in Seller Central.
   Settlement parsing and the refund-commission check are ported from the seller payout-matching pipeline (amazon.cjs). */
(function (root) {
  'use strict';
  var MAX_FEE_PCT = 24.99, DEFAULT_FEE_PCT = 20;
  function r2(x) { return Math.round(x * 100) / 100; }
  function num(s) { s = String(s == null ? '' : s).trim(); if (!s) return NaN; var neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^[^\d(-]+/, ''));
    var v = parseFloat(s.replace(/[^\d.]/g, '')); return isNaN(v) ? NaN : (neg ? -v : v); }
  function splitCSV(line) { var out = [], cur = '', q = false; for (var i = 0; i < line.length; i++) { var c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
  function parseTable(text) {
    text = String(text || '').replace(/^\uFEFF/, ''); var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); }); if (!lines.length) return [];
    var tab = lines[0].indexOf('\t') >= 0, sp = function (l) { return tab ? l.split('\t') : splitCSV(l); };
    var head = sp(lines[0]).map(function (h) { return h.trim().toLowerCase().replace(/[_ ]+/g, '-'); });
    return lines.slice(1).map(function (l) { var c = sp(l), o = {}; head.forEach(function (h, i) { o[h] = (c[i] || '').trim(); }); return o; });
  }
  function day(s) { var m = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  var LOST = /^(m|misplaced|lost.*)$/i, FOUND = /^(f|found)$/i, DAMAGED = /^(e|q|6|7|damaged.?(at.?)?(warehouse|fc)|warehouse.?damage.*|damaged.?inbound)$/i;
  function analyze(files, opt) {
    opt = Object.assign({ adminFeePct: 20, refundGraceDays: 45, defaultUnitCost: 0, unitCost: {}, tol: 0.05, feePct: DEFAULT_FEE_PCT }, opt || {});
    if (!(opt.feePct > 0 && opt.feePct <= MAX_FEE_PCT)) throw new Error('Recovery fee must be above 0% and below 25%');
    var S = parseTable(files.settlement), RB = parseTable(files.reimbursements), AD = parseTable(files.adjustments), RT = parseTable(files.returns);
    var items = [], dates = [];
    // settlements
    var sets = {}, ord = {}, feeLines = [];
    S.forEach(function (r) { var id = r['settlement-id']; if (!id) return; var s = sets[id] = sets[id] || { id: id, total: NaN, sum: 0, deposit: '' };
      if (r['total-amount']) { s.total = num(r['total-amount']); s.deposit = r['deposit-date'] || ''; dates.push(day(s.deposit)); return; }
      var a = num(r['amount']); if (isNaN(a)) return; s.sum += a;
      var tt = (r['transaction-type'] || '').toLowerCase(), at = (r['amount-type'] || '').toLowerCase(), ad = (r['amount-description'] || '').toLowerCase(), oid = r['order-id'];
      var pd = (r['posted-date'] || r['posted-date-time'] || s.deposit || '').slice(0, 10); dates.push(day(pd));
      if (oid) { var o = ord[oid] = ord[oid] || { comm: 0, commBack: 0, refundAmt: 0, refundDate: '', sku: r['sku'], sid: id };
        if (tt === 'order' && /commission/.test(ad)) o.comm += -a;
        if (tt === 'refund' && /commission/.test(ad)) o.commBack += a;
        if (tt === 'refund' && /itemprice/.test(at) && /principal/.test(ad)) { o.refundAmt += -a; o.refundDate = pd; } }
      if (tt === 'order' && /fbaperunitfulfillmentfee/.test(ad)) { var q = parseInt(r['quantity-purchased'], 10) || 1; feeLines.push({ sku: r['sku'], order: oid, qty: q, per: r2(-a / q), sid: id }); }
    });
    Object.keys(sets).forEach(function (k) { var s = sets[k]; if (!isNaN(s.total) && Math.abs(r2(s.sum) - s.total) > opt.tol)
      items.push({ ref: 'Settlement ' + k, type: 'SETTLEMENT_TOTAL_MISMATCH', amount: r2(s.total - s.sum), recoverable: 0, reason: 'Lines add to ' + r2(s.sum).toFixed(2) + ' but the total is ' + s.total.toFixed(2) + '. The export may be missing lines; check before anything else.' }); });
    // reimbursements index
    var reimbUnits = {}, perUnit = {}, reimbOrders = {};
    RB.forEach(function (r) { var f = r['fnsku'] || r['sku'], reason = r['reason'] || '', q = num(r['quantity-reimbursed-total']); dates.push(day(r['approval-date']));
      if (/lost|damaged/i.test(reason) && !isNaN(q)) reimbUnits[f] = (reimbUnits[f] || 0) + q;
      var pu = num(r['amount-per-unit']); if (pu > 0) (perUnit[f] = perUnit[f] || []).push(pu);
      if (r['amazon-order-id']) reimbOrders[r['amazon-order-id']] = true; });
    // inventory adjustments: lost/damaged minus found minus reimbursed
    var inv = {};
    AD.forEach(function (r) { var f = r['fnsku'] || r['sku']; if (!f) return; var q = num(r['quantity']), why = (r['reason'] || '').trim(); dates.push(day(r['adjusted-date'] || r['date']));
      var x = inv[f] = inv[f] || { sku: r['sku'], lost: 0, damaged: 0, found: 0 };
      if (LOST.test(why) && q < 0) x.lost += -q; else if (DAMAGED.test(why) && q < 0) x.damaged += -q; else if (FOUND.test(why) && q > 0) x.found += q; });
    Object.keys(inv).forEach(function (f) { var x = inv[f], gap = Math.max(0, x.lost - x.found) + x.damaged - (reimbUnits[f] || 0);
      if (gap <= 0) return; var pu = opt.unitCost[x.sku] || opt.unitCost[f] || median(perUnit[f]) || opt.defaultUnitCost, amt = r2(gap * pu);
      items.push({ ref: f + ' (' + x.sku + ')', type: 'LOST_OR_DAMAGED_NOT_REIMBURSED', amount: amt, recoverable: amt, units: gap,
        reason: gap + ' unit(s) shown lost or damaged in the warehouse (' + x.lost + ' lost, ' + x.found + ' found, ' + x.damaged + ' damaged) but only ' + (reimbUnits[f] || 0) + ' reimbursed. Value at ' + (pu ? pu.toFixed(2) + ' per unit' : 'unknown cost (enter your unit cost)') + '. Amazon claim windows are short (often 60 days); check the Reimbursements report first.' }); });
    // refunds with no return
    var asOf = Math.max.apply(null, dates.filter(function (d) { return !isNaN(d); }).concat([0])), returned = {};
    RT.forEach(function (r) { if (r['order-id']) returned[r['order-id']] = true; });
    Object.keys(ord).forEach(function (id) { var o = ord[id];
      if (o.comm > 0 && (o.refundAmt > 0 || o.commBack > 0)) { var back = r2(o.comm - Math.min(5, o.comm * opt.adminFeePct / 100)), gap = r2(back - o.commBack);
        if (gap > opt.tol) items.push({ ref: 'Order ' + id, type: 'REFUND_COMMISSION_NOT_RETURNED', amount: gap, recoverable: gap, reason: 'Commission ' + o.comm.toFixed(2) + ', credited back ' + o.commBack.toFixed(2) + '. Amazon normally returns it minus a refund administration fee (lesser of 5.00 or ' + opt.adminFeePct + '%).' }); }
      if (o.refundAmt > 0 && RT.length && !returned[id] && !reimbOrders[id] && asOf - day(o.refundDate) > opt.refundGraceDays * 864e5)
        items.push({ ref: 'Order ' + id, type: 'REFUND_WITHOUT_RETURN', amount: r2(o.refundAmt), recoverable: r2(o.refundAmt), reason: 'Refunded on ' + o.refundDate + ' with no return in the returns report and no reimbursement after ' + opt.refundGraceDays + ' days. Amazon may owe a reimbursement if the item was never returned.' }); });
    // FBA fee per unit above the usual fee for the same SKU
    var bySku = {}; feeLines.forEach(function (l) { (bySku[l.sku] = bySku[l.sku] || []).push(l); });
    Object.keys(bySku).forEach(function (k) { var L = bySku[k]; if (L.length < 3) return; var m = mode(L.map(function (l) { return l.per; }));
      L.forEach(function (l) { var ex = r2((l.per - m) * l.qty); if (l.per > m + 0.01 && ex > opt.tol) items.push({ ref: 'Order ' + l.order, type: 'FBA_FEE_ABOVE_USUAL', amount: ex, recoverable: ex, reason: 'FBA fee ' + l.per.toFixed(2) + ' per unit vs the usual ' + m.toFixed(2) + ' for ' + k + '. May mean a wrong size or weight tier; ask Amazon to re-measure.' }); }); });
    var total = r2(items.reduce(function (s, x) { return s + x.recoverable; }, 0)), byType = {};
    items.forEach(function (x) { byType[x.type] = r2((byType[x.type] || 0) + x.recoverable); });
    return { items: items, totalPossible: total, byType: byType, feePct: opt.feePct, feeIfAllRecovered: r2(total * opt.feePct / 100), asOf: asOf ? new Date(asOf).toISOString().slice(0, 10) : '' };
  }
  function median(a) { if (!a || !a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : r2((s[m - 1] + s[m]) / 2); }
  function mode(a) { var c = {}, best = a[0], n = 0; a.forEach(function (v) { c[v] = (c[v] || 0) + 1; if (c[v] > n || (c[v] === n && v < best)) { n = c[v]; best = v; } }); return best; }
  function toCSV(items) { function esc(v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v) && isNaN(+v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var c = ['ref', 'type', 'amount', 'recoverable', 'reason']; return c.join(',') + '\n' + items.map(function (x) { return c.map(function (k) { return esc(x[k]); }).join(','); }).join('\n') + '\n'; }
  var api = { analyze: analyze, parseTable: parseTable, num: num, toCSV: toCSV, MAX_FEE_PCT: MAX_FEE_PCT, DEFAULT_FEE_PCT: DEFAULT_FEE_PCT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AmazonLost = api;
})(this);
