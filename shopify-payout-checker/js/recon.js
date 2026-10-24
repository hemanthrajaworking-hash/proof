/* Shopify payout checker - matching logic. Runs only in the browser (or Node for tests).
   No network calls, no storage. Matching approach adapted from the gst-itc-recon proof
   (passes: exact -> within tolerance -> partial; every line gets a status and a next step). */
(function (root) {
  'use strict';
  function parseCSV(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); }); return o; });
  }
  // "$1,234.56" "1.234,56 €" "(12.00)" "-12" "1 234,56" "12.50 CR"
  function parseAmount(s) {
    if (s === undefined || s === null) return NaN;
    s = String(s).trim(); if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s) || /-/.test(s) || /\bDR\b/i.test(s);
    s = s.replace(/[^0-9.,]/g, '');
    if (!s) return NaN;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) { s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
    else if (lc > -1) { s = /,\d{1,2}$/.test(s) && (s.match(/,/g) || []).length === 1 ? s.replace(',', '.') : s.replace(/,/g, ''); }
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    var v = parseFloat(s); if (isNaN(v)) return NaN;
    return Math.round((neg ? -v : v) * 100) / 100;
  }
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  // returns days since epoch (UTC) or NaN. dayFirst for "03/04/2026"
  function parseDate(s, dayFirst) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return Date.UTC(+m[1], m[2] - 1, +m[3]) / 864e5;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) {
      var a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
      var d = dayFirst ? a : b, mo = dayFirst ? b : a;
      if (mo > 12 && d <= 12) { var t = d; d = mo; mo = t; }
      return Date.UTC(y, mo - 1, d) / 864e5;
    }
    if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/)) && MON[m[1].toLowerCase()] !== undefined) return Date.UTC(+m[3], MON[m[1].toLowerCase()], +m[2]) / 864e5;
    if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/)) && MON[m[2].toLowerCase()] !== undefined) return Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1]) / 864e5;
    return NaN;
  }
  function fmtDate(d) { return isNaN(d) ? '' : new Date(d * 864e5).toISOString().slice(0, 10); }
  function pick(o, names) { for (var i = 0; i < names.length; i++) if (o[names[i]] !== undefined && o[names[i]] !== '') return o[names[i]]; return ''; }
  function r2(x) { return Math.round(x * 100) / 100; }

  function normPayouts(rows, opt) {
    return rows.map(function (r, i) {
      var p = {
        idx: i, id: pick(r, ['payout id', 'id', 'payout']) || ('P' + (i + 1)),
        date: parseDate(pick(r, ['payout date', 'date', 'paid on', 'issued at']), opt.dayFirst),
        status: (pick(r, ['status']) || 'paid').toLowerCase(),
        charges: parseAmount(pick(r, ['charges', 'gross', 'sales'])) || 0,
        refunds: parseAmount(pick(r, ['refunds'])) || 0,
        adjustments: parseAmount(pick(r, ['adjustments', 'chargebacks'])) || 0,
        reserved: parseAmount(pick(r, ['reserved funds', 'reserves'])) || 0,
        fees: parseAmount(pick(r, ['fees'])) || 0,
        total: parseAmount(pick(r, ['total', 'net', 'amount', 'payout amount'])),
        currency: pick(r, ['currency']) || ''
      };
      // Shopify exports fees/refunds as negatives; normalise to positive magnitudes for reporting
      p.fees = Math.abs(p.fees); p.refunds = Math.abs(p.refunds);
      return p;
    });
  }
  function normBank(rows, opt) {
    return rows.map(function (r, i) {
      var amt = parseAmount(pick(r, ['amount', 'value', 'transaction amount']));
      if (isNaN(amt)) {
        var cr = parseAmount(pick(r, ['credit', 'deposit', 'deposits', 'money in', 'paid in']));
        var dr = parseAmount(pick(r, ['debit', 'withdrawal', 'withdrawals', 'money out', 'paid out']));
        amt = !isNaN(cr) && cr !== 0 ? Math.abs(cr) : (!isNaN(dr) ? -Math.abs(dr) : NaN);
      }
      return { idx: i, date: parseDate(pick(r, ['date', 'posted date', 'transaction date', 'posting date', 'value date']), opt.dayFirst), description: pick(r, ['description', 'details', 'memo', 'narrative', 'payee']), amount: amt };
    });
  }

  function reconcile(payoutRows, bankRows, opt) {
    opt = Object.assign({ amountTol: 0.05, windowBefore: 0, windowAfter: 5, partialPct: 0.2, dayFirst: false }, opt || {});
    var P = normPayouts(payoutRows, opt), B = normBank(bankRows, opt), used = {}, out = [], warnings = [];
    P.forEach(function (p) { if (isNaN(p.total)) warnings.push('Payout row ' + (p.idx + 2) + ': no readable total'); if (isNaN(p.date)) warnings.push('Payout row ' + (p.idx + 2) + ': no readable date'); });
    B.forEach(function (b) { if (isNaN(b.amount) || isNaN(b.date)) warnings.push('Bank row ' + (b.idx + 2) + ': unreadable date or amount, skipped'); });
    var credits = B.filter(function (b) { return b.amount > 0 && !isNaN(b.date); });
    var todo = P.filter(function (p) { return !isNaN(p.total) && !isNaN(p.date); }).sort(function (a, b) { return a.date - b.date || a.idx - b.idx; });
    function inWin(p, b) { var d = b.date - p.date; return d >= -opt.windowBefore && d <= opt.windowAfter; }
    function best(p, test) {
      var c = credits.filter(function (b) { return !used[b.idx] && inWin(p, b) && test(b); });
      c.sort(function (x, y) { return Math.abs(x.amount - p.total) - Math.abs(y.amount - p.total) || Math.abs(x.date - p.date) - Math.abs(y.date - p.date) || x.idx - y.idx; });
      return c[0];
    }
    var res = {};
    // pass 1: exact amount; pass 2: within tolerance; pass 3: partial (same window, within partialPct)
    [function (p, b) { return Math.abs(b.amount - p.total) < 0.005; },
     function (p, b) { return Math.abs(b.amount - p.total) <= opt.amountTol; },
     function (p, b) { return Math.abs(b.amount - p.total) <= Math.abs(p.total) * opt.partialPct; }].forEach(function (t, pass) {
      todo.forEach(function (p) {
        if (res[p.idx] || p.total <= 0) return;
        var b = best(p, function (b) { return t(p, b); });
        if (b) { used[b.idx] = 1; res[p.idx] = { b: b, pass: pass }; }
      });
    });
    P.forEach(function (p) {
      var r = res[p.idx], row = { payout_id: p.id, payout_date: fmtDate(p.date), currency: p.currency, charges: p.charges, refunds: p.refunds, adjustments: p.adjustments, fees: p.fees, payout_total: p.total, bank_date: '', bank_description: '', bank_amount: null, difference: null, status: '', next_step: '' };
      if (isNaN(p.total) || isNaN(p.date)) { row.status = 'UNREADABLE'; row.next_step = 'Check this row in the payouts file'; }
      else if (p.total <= 0) { row.status = 'NO_DEPOSIT_EXPECTED'; row.next_step = 'Payout is zero or negative (refunds/fees exceeded sales); Shopify may debit your bank or carry it forward'; }
      else if (!r) { row.status = 'MISSING_DEPOSIT'; row.next_step = 'No bank credit found within the date window; check the bank account on file in Shopify and the payout status (' + p.status + ')'; }
      else {
        row.bank_date = fmtDate(r.b.date); row.bank_description = r.b.description; row.bank_amount = r.b.amount; row.difference = r2(r.b.amount - p.total);
        if (r.pass === 0) { row.status = 'MATCHED'; row.next_step = ''; }
        else if (r.pass === 1) { row.status = 'MATCHED_WITHIN_TOLERANCE'; row.next_step = 'Small difference, likely rounding or a bank fee'; }
        else { row.status = 'PARTIAL'; row.next_step = (row.difference < 0 ? 'Bank received ' + Math.abs(row.difference).toFixed(2) + ' less than the payout' : 'Bank received ' + row.difference.toFixed(2) + ' more than the payout') + '; check for a split deposit, bank charge or FX'; }
      }
      out.push(row);
    });
    var extra = credits.filter(function (b) { return !used[b.idx] && /shopify/i.test(b.description); }).map(function (b) {
      return { payout_id: '', payout_date: '', currency: '', charges: null, refunds: null, adjustments: null, fees: null, payout_total: null, bank_date: fmtDate(b.date), bank_description: b.description, bank_amount: b.amount, difference: null, status: 'DEPOSIT_WITHOUT_PAYOUT', next_step: 'A Shopify-labelled deposit with no payout row; check the payouts export covers this date' };
    });
    out = out.concat(extra);
    var t = { payouts: P.length, matched: 0, tolerance: 0, partial: 0, missing: 0, extra: extra.length, gross: 0, refunds: 0, adjustments: 0, fees: 0, reserved: 0, expected: 0, received: 0, gap: 0 };
    P.forEach(function (p) { t.gross += p.charges; t.refunds += p.refunds; t.adjustments += p.adjustments; t.fees += p.fees; t.reserved += p.reserved; if (p.total > 0) t.expected += p.total; });
    out.forEach(function (r) {
      if (r.status === 'MATCHED') t.matched++; else if (r.status === 'MATCHED_WITHIN_TOLERANCE') t.tolerance++; else if (r.status === 'PARTIAL') t.partial++; else if (r.status === 'MISSING_DEPOSIT') t.missing++;
      if (r.bank_amount && r.payout_id) t.received += r.bank_amount;
    });
    ['gross', 'refunds', 'adjustments', 'fees', 'reserved', 'expected', 'received'].forEach(function (k) { t[k] = r2(t[k]); });
    t.gap = r2(t.expected - t.received);
    return { rows: out, totals: t, warnings: warnings, options: opt };
  }
  function toCSV(rows) {
    var cols = ['payout_id', 'payout_date', 'currency', 'charges', 'refunds', 'adjustments', 'fees', 'payout_total', 'bank_date', 'bank_description', 'bank_amount', 'difference', 'status', 'next_step'];
    function esc(v) { v = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(v) && isNaN(+v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return cols.join(',') + '\n' + rows.map(function (r) { return cols.map(function (c) { return esc(r[c]); }).join(','); }).join('\n') + '\n';
  }
  var api = { parseCSV: parseCSV, parseAmount: parseAmount, parseDate: parseDate, reconcile: reconcile, toCSV: toCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PayoutRecon = api;
})(this);
