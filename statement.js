import { calculateTotals, formatDate, formatMoney, localDateValue } from './logic.js';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDateValue(parsed) === value;
}

export function createStatement(state, from, to) {
  if (!validDate(from) || !validDate(to)) throw new Error('حدد تاريخ البداية وتاريخ النهاية بشكل صحيح.');
  if (from > to) throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.');
  const transactions = state.transactions.filter((item) => {
    const day = localDateValue(new Date(item.createdAt));
    return day >= from && day <= to;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totals = calculateTotals({ baseCapital: 0, transactions });
  return { from, to, capital: calculateTotals(state).capital, salesTotal: totals.salesTotal, purchaseTotal: totals.purchaseTotal,
    movement: totals.salesTotal - totals.purchaseTotal,
    sales: transactions.filter((item) => item.type === 'sale'), purchases: transactions.filter((item) => item.type === 'purchase') };
}

export function buildStatementHtml(report) {
  const money = (value) => `<bdi>${escapeHtml(formatMoney(value))}</bdi>`;
  const table = (title, rows) => `<h2>${title}</h2><table><colgroup><col style="width:25%"><col style="width:50%"><col style="width:25%"></colgroup><thead><tr><th>التاريخ</th><th>الوصف</th><th>المبلغ</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td><bdi>${escapeHtml(formatDate(item.createdAt))}</bdi></td><td>${escapeHtml(item.title || '—')}</td><td>${money(item.amount)}</td></tr>`).join('') : '<tr><td colspan="3">لا توجد عمليات خلال هذه الفترة.</td></tr>'}</tbody></table>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4e8d6"><title>فلافي — كشف العمليات</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
  *{box-sizing:border-box}body{margin:0;background:#f4eadb;color:#402719;font-family:"Cairo",Tahoma,Arial,sans-serif;line-height:1.7}.sheet{max-width:794px;margin:24px auto;padding:32px;background:white}h1{margin:0;font-size:28px}h2{font-size:19px;margin:22px 0 8px;break-after:avoid}p{margin:8px 0}.summary{border-block:1px solid #c89955;padding:12px 0}.summary p{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}th,td{text-align:right;padding:9px 6px;border-bottom:1px solid #dec8a8;overflow-wrap:anywhere}th{background:#f4eadb}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}bdi{direction:ltr}footer{margin-top:24px;border-top:2px solid #c89955;padding-top:12px}button{padding:12px 20px;margin:12px;border:0;border-radius:8px;background:#87502f;color:white;font:inherit;cursor:pointer}.toolbar{text-align:center}@page{size:A4 portrait;margin:15mm}@media(max-width:480px){.sheet{margin:0;padding:18px}th,td{padding:7px 3px;font-size:12px}}@media print{body{background:white}.sheet{margin:0;padding:0;max-width:none}.toolbar{display:none}h2{break-after:avoid-page}thead{display:table-header-group}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">طباعة / حفظ PDF</button></div><main class="sheet"><h1>فلافي</h1><p>كشف العمليات</p><p>الفترة: <bdi>${escapeHtml(formatDate(report.from + 'T12:00:00'))} – ${escapeHtml(formatDate(report.to + 'T12:00:00'))}</bdi></p><div class="summary"><p>رأس المال الحالي ${money(report.capital)}</p><p>إجمالي المبيعات خلال الفترة ${money(report.salesTotal)}</p><p>إجمالي المشتريات خلال الفترة ${money(report.purchaseTotal)}</p><p><strong>صافي حركة الفترة</strong> ${money(report.movement)}</p></div>${table('المبيعات', report.sales)}${table('المشتريات', report.purchases)}<footer><p>إجمالي المبيعات: ${money(report.salesTotal)}</p><p>إجمالي المشتريات: ${money(report.purchaseTotal)}</p></footer></main></body></html>`;
}
