/* Lost-money finder - builds on the payout checker's matching (../shopify-payout-checker/js/recon.js).
   Browser-only: no network, no storage. All "possible recovery" amounts are estimates for review. */
(function (root) {
  'use strict';
  // Estimated US Shopify Payments online card rates. Rates vary by country, card type and date: edit before relying on them.
  var RATE_TABLE = {
    basic: { label: 'Basic (estimate)', pct: 2.9, fixed: 0.30 },
    shopify: { label: 'Shopify / Grow (estimate)', pct: 2.7, fixed: 0.30 },
    advanced: { label: 'Advanced (estimate)', pct: 2.5, fixed: 0.30 },
    plus: { label: 'Plus (estimate)', pct: 2.4, fixed: 0.30 }
  };
  function r2(x) { return Math.round(x * 100) / 100; }
  function find(R, payoutRows, bankRows, opt) {
    opt = Object.assign({ plan: 'basic', rate: null, feeTol: 1.00, chargebackFee: 15.00, refundReviewPct: 25 }, opt || {});
    var rate = opt.rate || RATE_TABLE[opt.plan] || RATE_TABLE.basic;
    var rec = R.reconcile(payoutRows, bankRows || [], opt.match);
    var items = [], haveBank = (bankRows || []).length > 0;
    payoutRows.forEach(function (raw, i) {
      var row = rec.rows[i];
      var orders = parseInt(raw['orders'] || raw['order count'] || raw['transactions'] || '', 10);
      var charges = row.charges || 0, fees = row.fees || 0;
      if (charges > 0) {
        var expected = r2(charges * rate.pct / 100 + (isNaN(orders) ? 0 : orders * rate.fixed));
        var excess = r2(fees - expected);
        if (excess > opt.feeTol) items.push({ payout_id: row.payout_id, date: row.payout_date, type: 'FEES_ABOVE_ESTIMATE', amount: excess, recoverable: excess,
          reason: 'Fees ' + fees.toFixed(2) + ' vs estimated ' + expected.toFixed(2) + ' at ' + rate.pct + '% + ' + rate.fixed.toFixed(2) + (isNaN(orders) ? ' (no order count, fixed fee not included)' : ' x ' + orders + ' orders') + '. Check the transaction-level fees; may include currency/international card fees.' });
      }
      if ((row.adjustments || 0) < 0) {
        items.push({ payout_id: row.payout_id, date: row.payout_date, type: 'CHARGEBACK_OR_ADJUSTMENT', amount: r2(-row.adjustments), recoverable: r2(-row.adjustments),
          reason: 'Deducted as an adjustment/chargeback. If it is a dispute you can still answer, submitting evidence may win it back (plus the dispute fee, about ' + opt.chargebackFee.toFixed(2) + ', in some cases).' });
      }
      if (charges > 0 && row.refunds > charges * opt.refundReviewPct / 100) {
        items.push({ payout_id: row.payout_id, date: row.payout_date, type: 'HIGH_REFUNDS_REVIEW', amount: row.refunds, recoverable: 0,
          reason: 'Refunds are ' + Math.round(row.refunds / charges * 100) + '% of sales in this payout. Check for duplicate or unreturned-item refunds. Not counted as recoverable.' });
      }
      if (haveBank && row.status === 'MISSING_DEPOSIT') items.push({ payout_id: row.payout_id, date: row.payout_date, type: 'MISSING_DEPOSIT', amount: row.payout_total, recoverable: row.payout_total, reason: 'No matching bank deposit found. Ask Shopify Support for the payout trace, and check the bank account on file.' });
      if (row.status === 'PARTIAL' && row.difference < 0) items.push({ payout_id: row.payout_id, date: row.payout_date, type: 'SHORT_DEPOSIT', amount: -row.difference, recoverable: -row.difference, reason: 'Bank received ' + (-row.difference).toFixed(2) + ' less than the payout. Check for bank charges or a split deposit.' });
    });
    var total = r2(items.reduce(function (s, x) { return s + x.recoverable; }, 0)), byType = {};
    items.forEach(function (x) { byType[x.type] = r2((byType[x.type] || 0) + x.recoverable); });
    return { items: items, totalPossible: total, byType: byType, rate: rate, reconcile: rec };
  }
  function toCSV(items) {
    function esc(v) { v = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(v) && isNaN(+v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var c = ['payout_id', 'date', 'type', 'amount', 'recoverable', 'reason'];
    return c.join(',') + '\n' + items.map(function (x) { return c.map(function (k) { return esc(x[k]); }).join(','); }).join('\n') + '\n';
  }
  var api = { RATE_TABLE: RATE_TABLE, find: find, toCSV: toCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LostMoney = api;
})(this);
