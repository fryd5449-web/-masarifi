export const STORAGE_KEY = 'fluffy-business-v1';

export const createDefaultState = () => ({ baseCapital: 0, transactions: [], pendingOrders: [] });

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

const normalizePendingOrder = (order, index) => {
  if (!order || typeof order !== 'object') return null;
  const amount = toNumber(order.amount);
  const title = typeof order.title === 'string' ? order.title.trim().slice(0, 80) : '';
  if (amount <= 0 || !title) return null;
  return {
    id: typeof order.id === 'string' && order.id ? order.id : `pending-${index}`,
    amount,
    title,
    note: typeof order.note === 'string' ? order.note.slice(0, 240) : '',
    createdAt: typeof order.createdAt === 'string' && !Number.isNaN(new Date(order.createdAt).getTime()) ? order.createdAt : new Date().toISOString(),
  };
};

export const sanitizeState = (value) => {
  if (!value || typeof value !== 'object') return createDefaultState();
  return {
    baseCapital: toNumber(value.baseCapital),
    transactions: Array.isArray(value.transactions) ? value.transactions.map(normalizeTransaction).filter(Boolean) : [],
    pendingOrders: Array.isArray(value.pendingOrders) ? value.pendingOrders.map(normalizePendingOrder).filter(Boolean) : [],
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

export const formatDateTime = (value) => new Intl.DateTimeFormat('en-GB', { calendar: 'gregory', numberingSystem: 'latn', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

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

export const addPendingOrder = (state, { amount, title, note = '', createdAt = new Date().toISOString() }) => {
  const order = normalizePendingOrder({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount, title, note, createdAt }, state.pendingOrders.length);
  if (!order) throw new Error('اكتب اسم الطلب ومبلغًا صحيحًا.');
  return { ...state, pendingOrders: [...state.pendingOrders, order] };
};

export const confirmPendingOrder = (state, id) => {
  const order = state.pendingOrders.find((item) => item.id === id);
  if (!order) return state;
  const sale = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'sale',
    amount: order.amount,
    title: order.title,
    note: order.note,
    createdAt: order.createdAt,
  };
  return {
    ...state,
    pendingOrders: state.pendingOrders.filter((item) => item.id !== id),
    transactions: [...state.transactions, sale],
  };
};

export const deletePendingOrder = (state, id) => ({
  ...state,
  pendingOrders: state.pendingOrders.filter((item) => item.id !== id),
});
