import { DATA, orderTotal } from './data.mjs';
import { orderRows } from './state.mjs';
export const PAGE_SIZE = 4;
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
export function panel(id, title, build, revision) {
  const elements = {}, commands = {}, roles = {};
  let sequence = 0;
  const add = (type, props, children = [], role, command) => {
    const key = `${id}-${++sequence}`;
    elements[key] = { type, props: { id: key, ...props }, children };
    if (role) roles[key] = role;
    if (command) { const action = `act-${id}-${sequence}`; commands[action] = command; elements[key].on = { press: { action } }; }
    return key;
  };
  const api = {
    text: (text, role = 'body') => add('Text', { text: String(text).slice(0, 300) || 'Not provided' }, [], role),
    button: (label, command) => add('Button', { label }, [], 'action', command),
    card: (children, tone = 'light') => add('Card', { padding: 'fractional', tone }, children),
  };
  const children = build(api), root = add('Layout', { columns: 'single', gap: 'fractional' }, children);
  return { id, title, revision, spec: { root, elements }, contract: { textBindings: [], actions: Object.keys(commands) }, state: {}, commands, roles };
}
export function ordersPanels(state, data = DATA) {
  const rows = orderRows(state, data), ui = state.orders;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), page = Math.min(ui.page, pageCount - 1);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = data.orders.find((order) => order.id === ui.selected), customer = selected && data.customers.find((c) => c.id === selected.customerId);
  const counts = Object.fromEntries(['queued','packed','dispatched'].map((status) => [status, data.orders.filter((o) => state.orderStatus[o.id] === status).length]));
  const details = panel('order-detail', 'Linked order detail', ({ text, card, button }) => {
    if (!selected) return [text('Choose an order')];
    const op = (next) => ({ type: 'order-status', id: selected.id, next, revision: state.revision, view: 'orders' });
    const common = [text(selected.id, 'title'), text(customer.name, 'body'), text(`Status: ${state.orderStatus[selected.id]} · ${selected.date}`, 'caption'),
      text(rows.some((r) => r.id === selected.id) ? 'Selected record is in current results' : 'Selected record is hidden by current filters', 'caption')];
    const tab = ui.tab ?? 'summary';
    const detail = tab === 'lines' ? selected.lines.map((line) => { const product = data.products.find((p) => p.id === line.productId); return text(`${product.name} · ${line.quantity} × ${money(product.price)} = ${money(product.price * line.quantity)}`, 'body'); })
      : tab === 'history' ? [text('Local status history', 'title'), ...(state.history.filter(item=>item.ids?.includes(selected.id)).slice(-6).length ? state.history.filter(item=>item.ids?.includes(selected.id)).slice(-6).map(item=>text(`${item.type} → ${item.next} · revision ${item.revision}`, 'caption')) : [text('No accepted local status changes for this order', 'caption')])]
      : [text(selected.note ?? 'No order note', 'body'), text(customer.note ?? 'No customer note', 'caption'), text(`${selected.lines.length} product lines · ${customer.id}`, 'caption')];
    return [card([...common, ...detail, text(`Subtotal ${money(orderTotal(selected, data))} · No payment is processed`, 'metric'),
      button('Pack selected order', op('packed')), button('Dispatch selected order', op('dispatched'))])];
  }, state.revision);
  const overview = panel('order-stats', 'Order status counts', ({ text, card }) => [card([text('Orders in motion', 'title'),
    text(`${data.orders.length} fictional orders · ${data.customers.length} customers · ${data.products.length} products`, 'caption'),
    ...Object.entries(counts).map(([status, count]) => text(`${status}: ${count}`, 'metric'))], 'dark')], state.revision);
  return { panels: [overview, details], tableRows: visible.map(order => ({ id:order.id, customer:data.customers.find(c=>c.id===order.customerId).name, productSummary:order.lines.map(line=>data.products.find(p=>p.id===line.productId).name).join(', '), lineCount:order.lines.length, date:order.date, status:state.orderStatus[order.id], total:money(orderTotal(order,data)) })), rowIds: rows.map((o) => o.id), visibleIds: visible.map((o) => o.id), selectedId: selected?.id,
    selectedHidden: Boolean(selected && !rows.some((o) => o.id === selected.id)), page, pageCount, counts };
}
