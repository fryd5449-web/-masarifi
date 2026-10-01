import assert from 'node:assert/strict';
import test from 'node:test';
import { addPendingOrder, calculateTotals, confirmPendingOrder, deletePendingOrder, formatDate, formatMoney, sanitizeState } from '../logic.js';
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
  assert.deepEqual(sanitizeState({ salary: 10000, expenses: [{ name: 'الإيجار', amount: '2000' }] }), { baseCapital: 0, transactions: [], pendingOrders: [] });
});

test('pending orders remain separate until confirmed, then update existing sales totals', () => {
  const state = sanitizeState({ baseCapital: 5000, transactions: [] });
  const withOrder = addPendingOrder(state, { amount: 300, title: 'كيك شوكولاتة', createdAt: '2026-10-01T09:30:00.000Z' });
  assert.equal(withOrder.pendingOrders.length, 1);
  assert.equal(withOrder.transactions.length, 0);
  assert.equal(calculateTotals(withOrder).salesTotal, 0);
  assert.equal(createStatement(withOrder, '2026-10-01', '2026-10-01').sales.length, 0);
  const confirmed = confirmPendingOrder(withOrder, withOrder.pendingOrders[0].id);
  assert.equal(confirmed.pendingOrders.length, 0);
  assert.equal(confirmed.transactions.length, 1);
  assert.equal(confirmed.transactions[0].type, 'sale');
  assert.equal(confirmed.transactions[0].createdAt, '2026-10-01T09:30:00.000Z');
  assert.equal(calculateTotals(confirmed).salesTotal, 300);
  assert.equal(calculateTotals(confirmed).profit, -4700);
  const statement = createStatement(confirmed, '2026-10-01', '2026-10-01');
  assert.equal(statement.sales.length, 1);
  assert.equal(statement.sales[0].title, 'كيك شوكولاتة');
});

test('deleting pending order does not create a sale and pending orders survive sanitization', () => {
  const state = addPendingOrder(sanitizeState({ baseCapital: 5000 }), { amount: 150, title: 'خبز' });
  const restored = sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.pendingOrders.length, 1);
  const deleted = deletePendingOrder(restored, restored.pendingOrders[0].id);
  assert.equal(deleted.pendingOrders.length, 0);
  assert.equal(deleted.transactions.length, 0);
  assert.equal(calculateTotals(deleted).salesTotal, 0);
});
