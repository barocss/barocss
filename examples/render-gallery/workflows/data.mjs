const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const customerNames = ['Mina Studio', '한강 종이 공방', 'North Window', 'Blue Orchard', '작은 별 제작소', 'Quiet Desk', 'Long Meadow Cooperative — Fictional Design and Community Workshop', '달빛 서점', 'Amber Room', 'Cloud Thread', 'Forest Letter', '느린 오후'];
const productNames = ['Paper notebook', '도자기 컵', 'Desk tray', 'Cotton tote', '연필 세트', 'Reading lamp', 'Folded card', 'Wool coaster', '책갈피', 'Storage box', 'Canvas pouch', 'Wooden stand', '메모 패드', 'Archive folder', 'Travel journal with a long descriptive fictional title', 'Fabric banner'];
const data = {
  version: 1,
  asOf: '2026-10-01',
  customers: customerNames.map((name, index) => ({ id: `customer-${String(index + 1).padStart(2, '0')}`, name, ...(index % 3 === 0 ? { note: index === 0 ? 'Fictional studio. 납품 전 포장 상태와 항목을 확인해 주세요. This long note exercises readable wrapping without using real contact information.' : 'Authored workshop account; no contact or payment information.' } : {}) })),
  products: productNames.map((name, index) => ({ id: `product-${String(index + 1).padStart(2, '0')}`, name, price: 450 + index * 175 })),
  orders: Array.from({ length: 48 }, (_, index) => ({
    id: `order-${String(index + 1).padStart(3, '0')}`,
    customerId: `customer-${String(index % 12 + 1).padStart(2, '0')}`,
    date: `2026-09-${String(1 + index % 28).padStart(2, '0')}`,
    status: ['queued', 'packed', 'dispatched'][Math.floor(index / 12) % 3],
    ...(index % 4 === 0 ? { note: index === 0 ? 'Keep the notebook and ceramic cup in separate protective sleeves. 긴 요청 사항도 상세 화면에서 잘 보여야 합니다. This is synthetic fulfillment guidance for a local demonstration.' : 'Fictional local pickup; inspect the authored packing list.' } : {}),
    lines: Array.from({ length: 1 + index % 6 }, (_, line) => ({ productId: `product-${String((index + line * 3) % 16 + 1).padStart(2, '0')}`, quantity: 1 + (index + line) % 4 })),
  })),
  projects: ['Autumn workshop', '한강 전시 준비', 'Community archive'].map((name, index) => ({ id: `project-${index + 1}`, name })),
  assignees: ['Mina', '준', 'Theo', '다나', 'Ari', 'Sol'].map((name, index) => ({ id: `assignee-${index + 1}`, name })),
  tasks: Array.from({ length: 24 }, (_, index) => ({
    id: `task-${String(index + 1).padStart(3, '0')}`,
    projectId: `project-${index % 3 + 1}`,
    title: ['Prepare materials', '전시 안내문 검토', 'Review the archive catalog and its unusually long bilingual descriptive headings', 'Confirm workshop layout', '참여자 자료 묶음 정리', 'Check fictional delivery plan'][index % 6] + ` · ${index + 1}`,
    status: ['todo', 'doing', 'done'][Math.floor(index / 3) % 3],
    assigneeId: index % 5 === 0 ? null : `assignee-${index % 6 + 1}`,
    due: index % 4 === 0 ? null : `2026-${index % 2 === 0 ? '09' : '10'}-${String(1 + index % 28).padStart(2, '0')}`,
    subtasks: Array.from({ length: index % 5 }, (_, sub) => ({ id: `subtask-${index + 1}-${sub + 1}`, title: ['Check materials', '문구 검토', 'Inspect nested relation labels', 'Prepare the final fictional checklist'][sub], done: Math.floor(index / 3) % 3 === 2 || sub % 2 === 0 })),
  })),
};

const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, required, optional = []) => {
  if (!plain(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new Error('Invalid fixture object fields');
};
const text = value => typeof value === 'string' && value.length >= 1 && value.length <= 600;
const id = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function records(list, minimum, maximum) {
  if (!Array.isArray(list) || list.length < minimum || list.length > maximum) throw new Error('Fixture count out of bounds');
  const ids = new Set();
  for (const entry of list) {
    if (!plain(entry) || !id(entry.id) || ids.has(entry.id)) throw new Error('Invalid or duplicate fixture ID');
    ids.add(entry.id);
  }
  return ids;
}
/** Throw on malformed fixtures; return true for a fully validated authored dataset. */
export function validateData(value) {
  exact(value, ['version', 'asOf', 'customers', 'products', 'orders', 'projects', 'assignees', 'tasks']);
  if (value.version !== 1 || !date(value.asOf) || new TextEncoder().encode(JSON.stringify(value)).byteLength > 1024 * 1024) throw new Error('Invalid fixture version, date or size');
  const customers = records(value.customers, 10, 20);
  const products = records(value.products, 12, 24);
  records(value.orders, 40, 64);
  const projects = records(value.projects, 3, 3);
  const assignees = records(value.assignees, 5, 8);
  records(value.tasks, 20, 32);
  for (const item of value.customers) {
    exact(item, ['id', 'name'], ['note']);
    if (!text(item.name) || ('note' in item && !text(item.note))) throw new Error('Invalid customer text');
  }
  for (const item of value.products) {
    exact(item, ['id', 'name', 'price']);
    if (!text(item.name) || !Number.isSafeInteger(item.price) || item.price < 1 || item.price > 10000000) throw new Error('Invalid product price or text');
  }
  for (const item of value.orders) {
    exact(item, ['id', 'customerId', 'date', 'status', 'lines'], ['note']);
    if (!customers.has(item.customerId) || !date(item.date) || !['queued', 'packed', 'dispatched'].includes(item.status) || ('note' in item && !text(item.note)) || !Array.isArray(item.lines) || item.lines.length < 1 || item.lines.length > 6) throw new Error('Invalid order relation or fields');
    const lineIds = new Set();
    for (const line of item.lines) {
      exact(line, ['productId', 'quantity']);
      if (!products.has(line.productId) || lineIds.has(line.productId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) throw new Error('Invalid order line');
      lineIds.add(line.productId);
    }
    if (!Number.isSafeInteger(orderTotal(item, value))) throw new Error('Invalid order total');
  }
  for (const item of [...value.projects, ...value.assignees]) {
    exact(item, ['id', 'name']);
    if (!text(item.name)) throw new Error('Invalid related name');
  }
  const subIds = new Set();
  for (const item of value.tasks) {
    exact(item, ['id', 'projectId', 'title', 'status', 'assigneeId', 'due', 'subtasks']);
    if (!projects.has(item.projectId) || !text(item.title) || !['todo', 'doing', 'done'].includes(item.status) || (item.assigneeId !== null && !assignees.has(item.assigneeId)) || (item.due !== null && !date(item.due)) || !Array.isArray(item.subtasks) || item.subtasks.length > 4) throw new Error('Invalid task fields');
    for (const sub of item.subtasks) {
      exact(sub, ['id', 'title', 'done']);
      if (!id(sub.id) || subIds.has(sub.id) || !text(sub.title) || typeof sub.done !== 'boolean' || (item.status === 'done' && !sub.done)) throw new Error('Invalid subtask or completed task');
      subIds.add(sub.id);
    }
  }
  return true;
}
export function orderTotal(order, value = DATA) {
  return order.lines.reduce((sum, line) => {
    const product = value.products.find(item => item.id === line.productId);
    if (!product || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(product.price)) throw new Error('Invalid price relation');
    const total = sum + product.price * line.quantity;
    if (!Number.isSafeInteger(total)) throw new Error('Total exceeds safe integer range');
    return total;
  }, 0);
}
validateData(data);
export const DATA = freeze(data);
