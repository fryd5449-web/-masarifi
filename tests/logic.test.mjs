import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTotals, formatDate, formatMoney, sanitizeState } from '../logic.js';

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
