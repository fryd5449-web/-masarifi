import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTotals, formatDate, formatMoney, sanitizeState } from '../logic.js';
import { createStatement, buildStatementHtml } from '../statement.js';

const fixture = () => ({ baseCapital: 5000, transactions: [
  { id: 'p', type: 'purchase', amount: 200, title: 'دقيق', createdAt: '2026-10-01T12:00:00' },
  { id: 's1', type: 'sale', amount: 3000, title: 'كيك', createdAt: '2026-10-01T12:00:00' },
  { id: 's2', type: 'sale', amount: 3000, title: 'خبز', createdAt: '2026-10-31T23:59:00' },
  { id: 'outside', type: 'sale', amount: 10, title: 'خارج الفترة', createdAt: '2026-11-01T00:00:00' },
] });

test('statement includes boundary dates, separates types and excludes outside period', () => {
  const state = fixture(); const before = JSON.stringify(state);
  const report = createStatement(state, '2026-10-01', '2026-10-31');
  assert.equal(report.capital, 5200); assert.equal(report.salesTotal, 6000);
  assert.equal(report.purchaseTotal, 200); assert.equal(report.movement, 5800);
  assert.equal(report.sales.length, 2); assert.equal(report.purchases.length, 1);
  assert.ok(report.sales.every(t => t.type === 'sale'));
  assert.ok(report.purchases.every(t => t.type === 'purchase'));
  assert.equal(JSON.stringify(state), before);
});

test('statement rejects missing, invalid and reversed dates', () => {
  for (const [from,to] of [['',''],['2026-02-30','2026-03-01'],['2026-10-31','2026-10-01']]) {
    assert.throws(() => createStatement(fixture(), from, to));
  }
});

test('editing and deleting either type updates derived report and business totals', () => {
  const state = fixture(); state.transactions = state.transactions.filter(t => t.id !== 'outside');
  assert.equal(calculateTotals(state).profit, 800);
  state.transactions[0].amount = 100;
  state.transactions[1].amount = 2000;
  assert.equal(createStatement(state, '2026-10-01','2026-10-31').movement, 4900);
  state.transactions = state.transactions.filter(t => t.id !== 'p');
  assert.equal(calculateTotals(state).capital, 5000);
  state.transactions = state.transactions.filter(t => t.id !== 's1');
  assert.equal(calculateTotals(state).salesTotal, 3000);
});

test('statement escapes user content and uses print-only layout', () => {
  const state = fixture(); state.transactions[0].title = '<script>alert("x")</script>&';
  const html = buildStatementHtml(createStatement(state,'2026-10-01','2026-10-31'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('@media print')); assert.ok(html.includes('.toolbar{display:none}'));
  assert.ok(html.includes('01/10/2026')); assert.ok(!html.includes('خارج الفترة'));
});

test('empty period produces a valid statement without changing current capital', () => {
  const report = createStatement(fixture(),'2027-01-01','2027-01-31');
  assert.equal(report.movement, 0); assert.equal(report.capital, 5200);
  assert.ok(buildStatementHtml(report).includes('لا توجد عمليات خلال هذه الفترة.'));
});

test('Flavi business totals derive from base capital and transactions', () => {
  const state = sanitizeState({ baseCapital: 5000, transactions: [] });
  state.transactions.push({ id: 'purchase-1', type: 'purchase', amount: 200, title: 'دقيق وسكر', note: '', createdAt: '2026-10-01T12:00:00.000Z' });
  state.transactions.push({ id: 'sale-1', type: 'sale', amount: 3000, title: 'طلب أول', note: '', createdAt: '2026-10-01T12:00:00.000Z' });
  assert.deepEqual(calculateTotals(state), { purchaseTotal: 200, capital: 5200, salesTotal: 3000, profit: -2200 });
  state.transactions.push({ id: 'sale-2', type: 'sale', amount: 3000, title: 'طلب ثانٍ', note: '', createdAt: '2026-10-02T12:00:00.000Z' });
  assert.equal(calculateTotals(state).profit, 800);
});

test('deleting a purchase recalculates capital and profit from source data', () => {
  const state = sanitizeState({ baseCapital: 5000, transactions: [{ id: 'p', type: 'purchase', amount: 200, title: '', note: '', createdAt: '2026-10-01T12:00:00.000Z' }, { id: 's', type: 'sale', amount: 6000, title: '', note: '', createdAt: '2026-10-01T12:00:00.000Z' }] });
  state.transactions = state.transactions.filter((transaction) => transaction.id !== 'p');
  assert.equal(calculateTotals(state).capital, 5000); assert.equal(calculateTotals(state).profit, 1000);
});

test('display formatting uses Western digits and Gregorian date', () => {
  assert.equal(formatMoney(5200), '5,200 ر.س'); assert.equal(formatDate('2026-10-01T12:00:00.000Z'), '01/10/2026'); assert.doesNotMatch(formatMoney(5200), /[٠-٩]/u); assert.doesNotMatch(formatDate('2026-10-01T12:00:00.000Z'), /[٠-٩]|هـ|ربيع/u);
});

test('old Masareefi storage is not accepted as Flavi state', () => {
  assert.deepEqual(sanitizeState({ salary: 10000, expenses: [{ name: 'الإيجار', amount: '2000' }] }), { baseCapital: 0, transactions: [] });
});
