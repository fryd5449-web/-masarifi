import { STORAGE_KEY, calculateTotals, createDefaultState, createTransaction, formatDate, formatMoney, localDateValue, sanitizeState, toNumber } from './logic.js';
import { createStatement, buildStatementHtml } from './statement.js';

const $ = (selector) => document.querySelector(selector);
let state = loadState();
const elements = {
  baseCapital: $('#baseCapital'), capitalValue: $('#capitalValue'), capitalEditForm: $('#capitalEditForm'), salesValue: $('#salesValue'), profitValue: $('#profitValue'), profitCaption: $('#profitCaption'), profitPanel: $('#profitPanel'), operationsList: $('#operationsList'), modalBackdrop: $('#modalBackdrop'), modalTitle: $('#modalTitle'), transactionForm: $('#transactionForm'), transactionId: $('#transactionId'), transactionType: $('#transactionType'), transactionAmount: $('#transactionAmount'), transactionTitle: $('#transactionTitle'), titleLabel: $('#titleLabel'), transactionNote: $('#transactionNote'), transactionDate: $('#transactionDate'), formError: $('#formError'),
};

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? sanitizeState(JSON.parse(raw)) : createDefaultState(); } catch { return createDefaultState(); }
}

function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage can be unavailable in private browsing */ } }

function moneyMarkup(value) { const [amount, ...unit] = formatMoney(value).split(' '); return `${amount} <span class="currency">${unit.join(' ')}</span>`; }

function renderSummary() {
  const totals = calculateTotals(state);
  if (!elements.capitalValue) {
    const sales = state.transactions.filter((item) => item.type === 'sale');
    const purchases = state.transactions.filter((item) => item.type === 'purchase');
    elements.salesValue.textContent = formatMoney(totals.salesTotal);
    $('#purchasesValue').textContent = formatMoney(totals.purchaseTotal);
    $('#salesCount').textContent = String(sales.length);
    $('#purchasesCount').textContent = String(purchases.length);
    renderOperations($('#salesList'), sales);
    renderOperations($('#purchasesList'), purchases);
    return;
  }
  elements.capitalValue.innerHTML = moneyMarkup(totals.capital);
  elements.salesValue.innerHTML = moneyMarkup(totals.salesTotal);
  elements.profitValue.innerHTML = moneyMarkup(Math.abs(totals.profit));
  elements.profitPanel.classList.toggle('negative', totals.profit < 0);
  elements.profitCaption.textContent = totals.profit < 0 ? 'المتبقي للوصول لنقطة التعادل' : 'صافي الأرباح بعد خصم رأس المال';
  renderOperations(elements.operationsList, [...state.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
}

function renderOperations(container, transactions) {
  const visible = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  container.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'لا توجد عمليات بعد.'; container.append(empty); return;
  }
  visible.forEach((transaction) => {
    const row = document.createElement('article'); row.className = 'operation';
    const main = document.createElement('div'); main.className = 'operation-main';
    const title = document.createElement('div'); title.className = 'operation-title'; title.textContent = transaction.title || (container.closest('.list-card') ? (transaction.type === 'sale' ? 'بيع' : 'مشتريات') : '');
    const meta = document.createElement('div'); meta.className = 'operation-meta'; meta.textContent = `${formatDate(transaction.createdAt)}${transaction.note ? ` · ${transaction.note}` : ''}`; main.append(title, meta);
    const side = document.createElement('div'); side.className = 'operation-side';
    const type = document.createElement('span'); type.className = 'operation-type'; type.textContent = transaction.type === 'sale' ? 'مبيعات' : 'مشتريات';
    const amount = document.createElement('strong'); amount.className = `operation-amount ${transaction.type}`; amount.textContent = `${transaction.type === 'sale' ? '+' : '-'}${formatMoney(transaction.amount)}`;
    const actions = document.createElement('div'); actions.className = 'operation-actions';
    const edit = document.createElement('button'); edit.className = 'icon-btn'; edit.type = 'button'; edit.textContent = 'تعديل'; edit.addEventListener('click', () => openModal(transaction.type, transaction));
    const remove = document.createElement('button'); remove.className = 'icon-btn delete'; remove.type = 'button'; remove.textContent = 'حذف'; remove.addEventListener('click', () => { const index = state.transactions.findIndex((item) => item.id === transaction.id); if (index >= 0 && window.confirm('حذف هذه العملية؟')) { state.transactions.splice(index, 1); saveState(); renderSummary(); } });
    main.prepend(type); actions.append(edit, remove); side.append(amount, actions); row.append(main, side); container.append(row);
  });
}

function openModal(type, transaction) {
  elements.transactionId.value = transaction?.id ?? ''; elements.transactionType.value = type; elements.modalTitle.textContent = transaction ? 'تعديل العملية' : type === 'sale' ? 'إضافة بيع' : 'إضافة مشتريات'; elements.titleLabel.textContent = type === 'sale' ? 'وصف البيع / المنتج (اختياري)' : 'اسم المشتريات (اختياري)'; elements.transactionAmount.value = transaction?.amount ?? ''; elements.transactionTitle.value = transaction?.title ?? ''; elements.transactionNote.value = transaction?.note ?? ''; elements.transactionDate.value = transaction ? localDateValue(new Date(transaction.createdAt)) : localDateValue(); elements.formError.textContent = ''; elements.modalBackdrop.hidden = false; elements.transactionAmount.focus();
}

function closeModal() { elements.modalBackdrop.hidden = true; elements.transactionForm.reset(); elements.formError.textContent = ''; }

document.querySelectorAll('.add-transaction').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.type)));
$('#showCapitalEditor')?.addEventListener('click', () => { elements.baseCapital.value = state.baseCapital || ''; elements.capitalEditForm.hidden = false; elements.baseCapital.focus(); });
$('#saveCapital')?.addEventListener('click', () => { state.baseCapital = toNumber(elements.baseCapital.value); elements.baseCapital.value = state.baseCapital || ''; saveState(); elements.capitalEditForm.hidden = true; renderSummary(); });
$('#closeModal').addEventListener('click', closeModal); $('#cancelModal').addEventListener('click', closeModal); elements.modalBackdrop.addEventListener('click', (event) => { if (event.target === elements.modalBackdrop) closeModal(); });
elements.transactionForm.addEventListener('submit', (event) => {
  event.preventDefault(); const amount = toNumber(elements.transactionAmount.value); const date = elements.transactionDate.value;
  if (amount <= 0 || !date) { elements.formError.textContent = 'اكتب مبلغًا صحيحًا واختر التاريخ.'; return; }
  const transaction = createTransaction({ type: elements.transactionType.value, amount, title: elements.transactionTitle.value, note: elements.transactionNote.value, date }); const existingIndex = state.transactions.findIndex((item) => item.id === elements.transactionId.value);
  if (existingIndex >= 0) state.transactions[existingIndex] = { ...state.transactions[existingIndex], ...transaction, id: state.transactions[existingIndex].id }; else state.transactions.push(transaction);
  saveState(); closeModal(); renderSummary();
});

function openReport(print) {
  const error = $('#reportError');
  try {
    const report = createStatement(state, $('#fromDate').value, $('#toDate').value);
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('تعذر فتح الكشف. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.');
    popup.document.open();
    if (print) popup.addEventListener('load', () => { popup.focus(); popup.print(); }, { once: true });
    popup.document.write(buildStatementHtml(report));
    popup.document.close();
    error.textContent = '';
  } catch (failure) { error.textContent = failure.message || 'تعذر إنشاء الكشف. حاول مرة أخرى.'; }
}
$('#reportForm')?.addEventListener('submit', (event) => { event.preventDefault(); openReport(false); });
$('#printReport')?.addEventListener('click', () => openReport(true));
function refresh() { state = loadState(); if (elements.baseCapital) elements.baseCapital.value = state.baseCapital || ''; renderSummary(); }
window.addEventListener('pageshow', refresh);
window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) refresh(); });
refresh();
