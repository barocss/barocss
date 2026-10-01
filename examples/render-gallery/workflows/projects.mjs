import { DATA } from './data.mjs';
import { taskRows } from './state.mjs';
import { panel, PAGE_SIZE } from './panels.mjs';

const statusNames = ['todo', 'doing', 'done'];
const dueLabel = (task, data, status) => task.due === null ? 'No due date' : `${task.due}${task.due < data.asOf && status !== 'done' ? ' · Overdue' : ''}`;
const assigneeLabel = (task, data) => data.assignees.find(item => item.id === task.assigneeId)?.name ?? 'Unassigned';
const progressLabel = (task, state) => task.subtasks.length === 0 ? 'No subtasks' : `${task.subtasks.filter(subtask => state.subtaskDone[subtask.id]).length}/${task.subtasks.length} subtasks complete`;

/** Four authored projections of the unchanged five-component renderer contract. */
export function projectsPanels(state, data = DATA) {
  const rows = taskRows(state, data);
  const ui = state.projects;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(ui.page, pageCount - 1);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = data.tasks.find(task => task.id === ui.selected);
  const selectedHidden = Boolean(selected && !rows.some(task => task.id === selected.id));
  const counts = Object.fromEntries(statusNames.map(status => [status, data.tasks.filter(task => state.taskStatus[task.id] === status).length]));
  const columns = statusNames.map(status => panel(`project-${status}`, `${status} task column`, ({ text, card, button }) => {
    const tasks = visible.filter(task => state.taskStatus[task.id] === status);
    if (tasks.length === 0) return [text(`No ${status} tasks on this page`, 'caption')];
    return tasks.map(task => card([
      text(task.title, 'title'),
      text(`${task.id} · ${state.taskStatus[task.id]}`, 'caption'),
      text(`${data.projects.find(project => project.id === task.projectId).name} · ${assigneeLabel(task, data)}`, 'caption'),
      text(dueLabel(task, data, state.taskStatus[task.id]), 'caption'),
      text(progressLabel(task, state), 'metric'),
      button(`Inspect ${task.id}`, { type: 'select', workspace: 'projects', id: task.id }),
    ]));
  }, state.revision));
  const detail = panel('project-detail', 'Selected task detail', ({ text, card, button }) => {
    if (!selected) return [text('Choose a task', 'caption')];
    const status = state.taskStatus[selected.id];
    const statusOperation = next => ({ type: 'task-status', id: selected.id, next, revision: state.revision, view: 'projects' });
    const subtaskNodes = selected.subtasks.length === 0 ? [text('No subtasks', 'caption')] : selected.subtasks.flatMap(subtask => [
      text(`${state.subtaskDone[subtask.id] ? 'Complete' : 'Open'} · ${subtask.title}`, 'body'),
      button(`${state.subtaskDone[subtask.id] ? 'Reopen' : 'Finish'} ${subtask.id}`, {
        type: 'subtask', id: subtask.id, taskId: selected.id, done: !state.subtaskDone[subtask.id], revision: state.revision, view: 'projects',
      }),
    ]);
    return [card([
      text(selected.title, 'title'),
      text(`${selected.id} · Status: ${status}`, 'caption'),
      text(`Project: ${data.projects.find(project => project.id === selected.projectId).name}`, 'body'),
      text(`Assignee: ${assigneeLabel(selected, data)}`, 'body'),
      text(dueLabel(selected, data, status), 'caption'),
      text(selectedHidden ? 'Selected task is hidden by current filters' : 'Selected task is in current results', 'caption'),
      text(progressLabel(selected, state), 'metric'),
      ...subtaskNodes,
      text('Completion requires every subtask. Reopen a completed task before editing subtasks.', 'caption'),
      button('Begin work', statusOperation('doing')),
      button('Complete task', statusOperation('done')),
      button('Return to todo', statusOperation('todo')),
    ])];
  }, state.revision);
  return {
    panels: [...columns, detail],
    rowIds: rows.map(task => task.id),
    visibleIds: visible.map(task => task.id),
    selectedId: selected?.id,
    selectedHidden,
    page,
    pageCount,
    counts,
  };
}
