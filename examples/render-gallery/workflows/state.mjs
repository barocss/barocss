import { DATA, orderTotal } from './data.mjs';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const orderStates = ['queued', 'packed', 'dispatched'];
const taskStates = ['todo', 'doing', 'done'];
export function initialState(data = DATA) {
  return {
    view: 'orders', revision: 0,
    orders: { query: '', status: 'all', customer: 'all', sort: 'date-desc', page: 0, selected: data.orders[0].id, tab: 'summary', checked: [] },
    projects: { query: '', status: 'all', project: 'all', assignee: 'all', sort: 'due-asc', page: 0, selected: data.tasks[0].id },
    orderStatus: Object.fromEntries(data.orders.map(item => [item.id, item.status])),
    taskStatus: Object.fromEntries(data.tasks.map(item => [item.id, item.status])),
    subtaskDone: Object.fromEntries(data.tasks.flatMap(item => item.subtasks.map(sub => [sub.id, sub.done]))),
    history: [], error: '',
  };
}
const reject = (state, message) => ({ ...state, error: message.slice(0, 200), history: [...state.history, { result: 'rejected', message: message.slice(0, 200), revision: state.revision }].slice(-128) });
const accept = (state, next, type, op) => ({ ...next, error: '', history: [...state.history, { result: 'accepted', type, revision: next.revision, ...(op ? { ids: op.ids ?? [op.taskId ?? op.id], ...(op.next ? { next: op.next } : { done: op.done }) } : {}) }].slice(-128) });
const own = (value, key) => Object.hasOwn(value, key);
const fields = (op, names) => op && typeof op === 'object' && !Array.isArray(op) && Object.keys(op).every(key => names.includes(key)) && names.every(key => own(op, key));
function filterAllowed(workspace, key, value, data) {
  if (key === 'query') return typeof value === 'string' && value.length <= 120;
  if (workspace === 'orders') {
    if (key === 'tab') return ['summary', 'lines', 'history'].includes(value);
    if (key === 'status') return ['all', ...orderStates].includes(value);
    if (key === 'customer') return value === 'all' || data.customers.some(item => item.id === value);
    if (key === 'sort') return ['date-desc', 'date-asc', 'total-desc', 'total-asc'].includes(value);
  } else {
    if (key === 'status') return ['all', ...taskStates].includes(value);
    if (key === 'project') return value === 'all' || data.projects.some(item => item.id === value);
    if (key === 'assignee') return ['all', 'unassigned'].includes(value) || data.assignees.some(item => item.id === value);
    if (key === 'sort') return ['due-asc', 'due-desc'].includes(value);
  }
  return false;
}
/** UI operations retain revision. Accepted entity operations increment revision once. */
function transition(state, op, data = DATA) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return reject(state, 'Invalid operation');
  if (op.type === 'view') {
    if (!fields(op, ['type', 'view']) || !['orders', 'projects', 'specimens'].includes(op.view)) return reject(state, 'Unknown view');
    return accept(state, { ...state, view: op.view }, op.type);
  }
  if (['filter', 'select', 'page', 'check', 'clear-checks'].includes(op.type)) {
    const workspace = op.workspace;
    if (!['orders', 'projects'].includes(workspace) || state.view !== workspace) return reject(state, 'Operation does not match the current workspace');
    let next;
    if (op.type === 'clear-checks') {
      if (workspace !== 'orders' || !fields(op, ['type','workspace'])) return reject(state, 'Invalid selection reset');
      next = { ...state.orders, checked: [] };
    } else if (op.type === 'filter') {
      if (!fields(op, ['type', 'workspace', 'key', 'value']) || !filterAllowed(workspace, op.key, op.value, data)) return reject(state, 'Unknown filter or sort value');
      next = { ...state[workspace], [op.key]: op.value, ...(op.key === 'tab' ? {} : { page: 0 }) };
    } else if (op.type === 'select') {
      const list = workspace === 'orders' ? data.orders : data.tasks;
      if (!fields(op, ['type', 'workspace', 'id']) || !list.some(item => item.id === op.id)) return reject(state, 'Unknown selection target');
      next = { ...state[workspace], selected: op.id };
    } else if (op.type === 'check') {
      const visible = orderRows(state, data).slice(state.orders.page * 4, state.orders.page * 4 + 4);
      if (workspace !== 'orders' || !fields(op, ['type', 'workspace', 'id', 'checked']) || typeof op.checked !== 'boolean' || !visible.some(item => item.id === op.id)) return reject(state, 'Check target is not on the current page');
      const checked = op.checked ? [...new Set([...state.orders.checked, op.id])] : state.orders.checked.filter(id => id !== op.id);
      if (checked.length > 4) return reject(state, 'Select at most four orders');
      next = { ...state.orders, checked };
    } else {
      const rows = workspace === 'orders' ? orderRows(state, data) : taskRows(state, data);
      const maxPage = Math.max(0, Math.ceil(rows.length / 4) - 1);
      if (!fields(op, ['type', 'workspace', 'value']) || !Number.isSafeInteger(op.value) || op.value < 0 || op.value > maxPage) return reject(state, 'Page is outside the current result range');
      next = { ...state[workspace], page: op.value };
    }
    return accept(state, { ...state, [workspace]: next }, op.type);
  }
  if (!['order-status', 'order-bulk', 'task-status', 'subtask'].includes(op.type)) return reject(state, 'Unknown operation');
  const workspace = ['order-status', 'order-bulk'].includes(op.type) ? 'orders' : 'projects';
  const expectedFields = op.type === 'order-bulk' ? ['type', 'ids', 'next', 'revision', 'view'] : op.type === 'subtask' ? ['type', 'id', 'taskId', 'done', 'revision', 'view'] : ['type', 'id', 'next', 'revision', 'view'];
  if (!fields(op, expectedFields) || state.view !== workspace || op.view !== workspace) return reject(state, 'Action does not match the current workspace');
  if (!Number.isSafeInteger(op.revision) || op.revision !== state.revision) return reject(state, 'Stale action revision');
  if (op.type === 'order-bulk') {
    const visibleIds = new Set(orderRows(state, data).slice(state.orders.page * 4, state.orders.page * 4 + 4).map(item => item.id));
    if (op.next !== 'packed' || !Array.isArray(op.ids) || op.ids.length < 1 || op.ids.length > 4 || new Set(op.ids).size !== op.ids.length || op.ids.some(id => !visibleIds.has(id) || !state.orders.checked.includes(id) || state.orderStatus[id] !== 'queued')) return reject(state, 'Bulk packing requires one to four checked queued orders on the current page');
    const orderStatus = { ...state.orderStatus };
    for (const id of op.ids) orderStatus[id] = 'packed';
    return accept(state, { ...state, orderStatus, revision: state.revision + 1 }, op.type, op);
  }
  const target = op.type === 'subtask' ? op.taskId : op.id;
  if (state[workspace].selected !== target) return reject(state, 'Action target is not the selected record');
  let next;
  if (op.type === 'order-status') {
    if (!data.orders.some(item => item.id === op.id)) return reject(state, 'Unknown order target');
    const current = state.orderStatus[op.id];
    if (!orderStates.includes(op.next) || orderStates.indexOf(op.next) !== orderStates.indexOf(current) + 1) return reject(state, 'Order transition is not permitted');
    next = { ...state, orderStatus: { ...state.orderStatus, [op.id]: op.next } };
  } else {
    const task = data.tasks.find(item => item.id === target);
    if (!task) return reject(state, 'Unknown task target');
    if (op.type === 'task-status') {
      const current = state.taskStatus[op.id];
      const transitions = { todo: ['doing'], doing: ['todo', 'done'], done: ['doing'] };
      if (!transitions[current]?.includes(op.next)) return reject(state, 'Task transition is not permitted');
      if (op.next === 'done' && task.subtasks.some(sub => !state.subtaskDone[sub.id])) return reject(state, 'Complete every subtask before completing this task');
      next = { ...state, taskStatus: { ...state.taskStatus, [op.id]: op.next } };
    } else {
      if (!task.subtasks.some(sub => sub.id === op.id) || typeof op.done !== 'boolean') return reject(state, 'Unknown subtask target or value');
      if (state.taskStatus[target] === 'done') return reject(state, 'Reopen the completed task before editing subtasks');
      if (state.subtaskDone[op.id] === op.done) return reject(state, 'Subtask already has this value');
      next = { ...state, subtaskDone: { ...state.subtaskDone, [op.id]: op.done } };
    }
  }
  return accept(state, { ...next, revision: state.revision + 1 }, op.type, op);
}
/** Retain bounded operation inputs so captures can reproduce the session transitions. */
export function reduce(state, op, data = DATA) {
  const next = transition(state, op, data), operation = {};
  if (op && typeof op === 'object' && !Array.isArray(op)) for (const key of ['type','view','workspace','key','value','id','taskId','next','done','checked','revision','ids']) {
    if (!Object.hasOwn(op,key)) continue;
    const value=op[key];
    if (typeof value==='string') operation[key]=value.slice(0,120);
    else if (typeof value==='boolean' || Number.isSafeInteger(value)) operation[key]=value;
    else if (key==='ids' && Array.isArray(value)) operation.ids=value.slice(0,4).map(id=>typeof id==='string'?id.slice(0,64):'[invalid]');
    else operation[key]='[invalid]';
  }
  return {...next,history:[...next.history.slice(0,-1),{...next.history.at(-1),operation}]};
}
export function orderRows(state, data = DATA) {
  const ui = state.orders;
  const query = ui.query.trim().toLowerCase();
  return data.orders.filter(order => {
    const customer = data.customers.find(item => item.id === order.customerId);
    const searchable = [order.id, customer.name, customer.note ?? '', order.note ?? '', ...order.lines.map(line => data.products.find(item => item.id === line.productId).name)].join(' ').toLowerCase();
    return (!query || searchable.includes(query)) && (ui.status === 'all' || state.orderStatus[order.id] === ui.status) && (ui.customer === 'all' || order.customerId === ui.customer);
  }).sort((a, b) => {
    const primary = ui.sort.startsWith('date') ? compare(a.date, b.date) : compare(orderTotal(a, data), orderTotal(b, data));
    return (ui.sort.endsWith('desc') ? -primary : primary) || compare(a.id, b.id);
  });
}
export function taskRows(state, data = DATA) {
  const ui = state.projects;
  const query = ui.query.trim().toLowerCase();
  return data.tasks.filter(task => {
    const project = data.projects.find(item => item.id === task.projectId);
    const assignee = data.assignees.find(item => item.id === task.assigneeId);
    const searchable = [task.id, task.title, project.name, assignee?.name ?? '', ...task.subtasks.map(sub => sub.title)].join(' ').toLowerCase();
    return (!query || searchable.includes(query)) && (ui.status === 'all' || state.taskStatus[task.id] === ui.status) && (ui.project === 'all' || task.projectId === ui.project) && (ui.assignee === 'all' || (ui.assignee === 'unassigned' ? task.assigneeId === null : task.assigneeId === ui.assignee));
  }).sort((a, b) => {
    if (a.due === null && b.due !== null) return 1;
    if (b.due === null && a.due !== null) return -1;
    const primary = compare(a.due ?? '', b.due ?? '');
    return (ui.sort === 'due-desc' ? -primary : primary) || compare(a.id, b.id);
  });
}
