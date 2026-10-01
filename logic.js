export const STORAGE_KEY = 'fluffy-business-v1';

export const createDefaultState = () => ({ baseCapital: 0, transactions: [] });

export const normalizeDigits = (value) => String(value ?? '')
  .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٬,\s]/gu, '')
  .replace(/٫/gu, '.');

export const toNumber = (value) => {
  const cleaned = normalizeDigits(value).replace(/[^\d.]/gu, '');
  const firstDot = cleaned.indexOf('.');
  const safe = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./gu, '');
  const amount = Number(safe);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const normalizeTransaction = (transaction, index) => {
  if (!transaction || typeof transaction !== 'object') return null;
  const type = transaction.type === 'sale' || transaction.type === 'purchase' ? transaction.type : null;
  const amount = toNumber(transaction.amount);
  if (!type || amount <= 0) return null;
  return {
    id: typeof transaction.id === 'string' && transaction.id ? transaction.id : `legacy-${index}`,
    type,
    amount,
    title: typeof transaction.title === 'string' ? transaction.title.slice(0, 80) : '',
    note: typeof transaction.note === 'string' ? transaction.note.slice(0, 240) : '',
    createdAt: typeof transaction.createdAt === 'string' && !Number.isNaN(new Date(transaction.createdAt).getTime()) ? transaction.createdAt : new Date().toISOString(),
  };
};

export const sanitizeState = (value) => {
  if (!value || typeof value !== 'object') return createDefaultState();
  return {
    baseCapital: toNumber(value.baseCapital),
    transactions: Array.isArray(value.transactions) ? value.transactions.map(normalizeTransaction).filter(Boolean) : [],
  };
};

export const calculateTotals = (state) => {
  const purchaseTotal = state.transactions.filter((transaction) => transaction.type === 'purchase').reduce((total, transaction) => total + transaction.amount, 0);
  const salesTotal = state.transactions.filter((transaction) => transaction.type === 'sale').reduce((total, transaction) => total + transaction.amount, 0);
  const capital = state.baseCapital + purchaseTotal;
  return { purchaseTotal, capital, salesTotal, profit: salesTotal - capital };
};

export const formatMoney = (value) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} ر.س`;

export const formatDate = (value) => new Intl.DateTimeFormat('en-GB', { calendar: 'gregory', numberingSystem: 'latn', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));

export const localDateValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const createTransaction = ({ type, amount, title, note, date }) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  amount: toNumber(amount),
  title: String(title ?? '').trim().slice(0, 80),
  note: String(note ?? '').trim().slice(0, 240),
  createdAt: new Date(`${date}T12:00:00`).toISOString(),
});
