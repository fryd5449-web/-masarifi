import { STORAGE_KEY, calculateTotals, createDefaultState, createTransaction, formatDate, formatMoney, localDateValue, sanitizeState, toNumber } from './logic.js';

const $ = (selector) => document.querySelector(selector);
const state = loadState();
let showAll = false;
const elements = {
  baseCapital: $('#baseCapital'), capitalValue: $('#capitalValue'), salesValue: $('#salesValue'), profitValue: $('#profitValue'), profitCaption: $('#profitCaption'), profitPanel: $('#profitPanel'), operationsList: $('#operationsList'), toggleAll: $('#toggleAll'), modalBackdrop: $('#modalBackdrop'), modalTitle: $('#modalTitle'), transactionForm: $('#transactionForm'), transactionId: $('#transactionId'), transactionType: $('#transactionType'), transactionAmount: $('#transactionAmount'), transactionTitle: $('#transactionTitle'), titleLabel: $('#titleLabel'), transactionNote: $('#transactionNote'), transactionDate: $('#transactionDate'), formError: $('#formError'),
};

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? sanitizeState(JSON.parse(raw)) : createDefaultState(); } catch { return createDefaultState(); }
}

function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage can be unavailable in private browsing */ } }

function moneyMarkup(value) { const [amount, ...unit] = formatMoney(value).split(' '); return `${amount} <span class="currency">${unit.join(' ')}</span>`; }

function renderSummary() {
  const totals = calculateTotals(state);
  elements.capitalValue.innerHTML = moneyMarkup(totals.capital);
  elements.salesValue.innerHTML = moneyMarkup(totals.salesTotal);
  elements.profitValue.innerHTML = moneyMarkup(Math.abs(totals.profit));
  elements.profitPanel.classList.toggle('negative', totals.profit < 0);
  elements.profitCaption.textContent = totals.profit < 0 ? 'المتبقي للوصول لنقطة التعادل' : 'صافي الأرباح بعد خصم رأس المال';
  renderOperations();
}

function renderOperations() {
  const transactions = [...state.transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visible = showAll ? transactions : transactions.slice(0, 5);
  elements.operationsList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'لا توجد عمليات بعد. أضف أول مشتريات أو بيع للمشروع.'; elements.operationsList.append(empty); elements.toggleAll.hidden = true; return;
  }
  elements.toggleAll.hidden = false; elements.toggleAll.textContent = showAll ? 'إخفاء السجل' : 'عرض الكل';
  visible.forEach((transaction) => {
    const row = document.createElement('article'); row.className = 'operation';
    const main = document.createElement('div'); main.className = 'operation-main';
    const title = document.createElement('div'); title.className = 'operation-title'; title.textContent = transaction.title || (transaction.type === 'sale' ? 'بيع' : 'مشتريات');
    const meta = document.createElement('div'); meta.className = 'operation-meta'; meta.textContent = `${formatDate(transaction.createdAt)}${transaction.note ? ` · ${transaction.note}` : ''}`; main.append(title, meta);
    const side = document.createElement('div'); side.className = 'operation-side';
    const type = document.createElement('span'); type.className = 'operation-type'; type.textContent = transaction.type === 'sale' ? 'مبيعات' : 'مشتريات';
    const amount = document.createElement('strong'); amount.className = `operation-amount ${transaction.type}`; amount.textContent = `${transaction.type === 'sale' ? '+' : '-'}${formatMoney(transaction.amount)}`;
    const actions = document.createElement('div'); actions.className = 'operation-actions';
    const edit = document.createElement('button'); edit.className = 'icon-btn'; edit.type = 'button'; edit.textContent = 'تعديل'; edit.addEventListener('click', () => openModal(transaction.type, transaction));
    const remove = document.createElement('button'); remove.className = 'icon-btn delete'; remove.type = 'button'; remove.textContent = 'حذف'; remove.addEventListener('click', () => { const index = state.transactions.findIndex((item) => item.id === transaction.id); if (index >= 0 && window.confirm('حذف هذه العملية؟')) { state.transactions.splice(index, 1); saveState(); renderSummary(); } });
    actions.append(edit, remove); side.append(type, amount, actions); row.append(main, side); elements.operationsList.append(row);
  });
}

function openModal(type, transaction) {
  elements.transactionId.value = transaction?.id ?? ''; elements.transactionType.value = type; elements.modalTitle.textContent = transaction ? 'تعديل العملية' : type === 'sale' ? 'إضافة بيع' : 'إضافة مشتريات'; elements.titleLabel.textContent = type === 'sale' ? 'وصف البيع / المنتج (اختياري)' : 'اسم المشتريات (اختياري)'; elements.transactionAmount.value = transaction?.amount ?? ''; elements.transactionTitle.value = transaction?.title ?? ''; elements.transactionNote.value = transaction?.note ?? ''; elements.transactionDate.value = transaction ? localDateValue(new Date(transaction.createdAt)) : localDateValue(); elements.formError.textContent = ''; elements.modalBackdrop.hidden = false; elements.transactionAmount.focus();
}

function closeModal() { elements.modalBackdrop.hidden = true; elements.transactionForm.reset(); elements.formError.textContent = ''; }

document.querySelectorAll('.add-transaction').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.type)));
$('#saveCapital').addEventListener('click', () => { state.baseCapital = toNumber(elements.baseCapital.value); elements.baseCapital.value = state.baseCapital || ''; saveState(); renderSummary(); });
elements.toggleAll.addEventListener('click', () => { showAll = !showAll; renderOperations(); });
$('#closeModal').addEventListener('click', closeModal); $('#cancelModal').addEventListener('click', closeModal); elements.modalBackdrop.addEventListener('click', (event) => { if (event.target === elements.modalBackdrop) closeModal(); });
elements.transactionForm.addEventListener('submit', (event) => {
  event.preventDefault(); const amount = toNumber(elements.transactionAmount.value); const date = elements.transactionDate.value;
  if (amount <= 0 || !date) { elements.formError.textContent = 'اكتب مبلغًا صحيحًا واختر التاريخ.'; return; }
  const transaction = createTransaction({ type: elements.transactionType.value, amount, title: elements.transactionTitle.value, note: elements.transactionNote.value, date }); const existingIndex = state.transactions.findIndex((item) => item.id === elements.transactionId.value);
  if (existingIndex >= 0) state.transactions[existingIndex] = { ...state.transactions[existingIndex], ...transaction, id: state.transactions[existingIndex].id }; else state.transactions.push(transaction);
  saveState(); closeModal(); renderSummary();
});

elements.baseCapital.value = state.baseCapital || ''; renderSummary();
