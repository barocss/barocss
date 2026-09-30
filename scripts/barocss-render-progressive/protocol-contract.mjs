import path from 'node:path';

// Pinned Codex 0.156.1 v1 InitializeResponse and v2 response/notification schemas.
// These are deliberately narrower host checks, not a general JSON Schema validator.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0;
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every((key) => allowed.includes(key));
const phases = new Set(['initializing', 'starting-session', 'turn-active', 'between-turns']);
const plans = new Set(['free', 'go', 'plus', 'pro', 'prolite', 'team', 'self_serve_business_prolite',
  'self_serve_business_usage_based', 'business', 'ent26', 'enterprise_cbp_automation',
  'enterprise_cbp_usage_based', 'enterprise', 'edu', 'edu_plus', 'edu_pro', 'unknown']);
const requireValid = (condition, message) => { if (!condition) throw new Error(message); };
const nullable = (value, check) => value === undefined || value === null || check(value);
const int32 = (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const string = (value) => typeof value === 'string';
const reachedTypes = new Set(['rate_limit_reached', 'workspace_owner_credits_depleted',
  'workspace_member_credits_depleted', 'workspace_owner_usage_limit_reached',
  'workspace_member_usage_limit_reached']);

// Sparse rolling updates are informational. Missing/null fields do not clear prior data or
// grant headroom; this host deliberately keeps no quota state and never dispatches from it.
function validRateLimitSnapshot(value) {
  const window = (item) => keys(item, ['usedPercent', 'windowDurationMins', 'resetsAt'])
    && int32(item.usedPercent) && nullable(item.windowDurationMins, Number.isSafeInteger)
    && nullable(item.resetsAt, Number.isSafeInteger);
  const credits = (item) => keys(item, ['hasCredits', 'unlimited', 'balance'])
    && typeof item.hasCredits === 'boolean' && typeof item.unlimited === 'boolean'
    && nullable(item.balance, string);
  const spend = (item) => keys(item, ['limit', 'remainingPercent', 'resetsAt', 'used'])
    && string(item.limit) && string(item.used) && int32(item.remainingPercent)
    && Number.isSafeInteger(item.resetsAt);
  return keys(value, ['credits', 'individualLimit', 'limitId', 'limitName', 'normalModelSlug',
    'planType', 'primary', 'secondary', 'rateLimitReachedType', 'spendControlReached'])
    && ['limitId', 'limitName', 'normalModelSlug'].every((key) => nullable(value[key], string))
    && nullable(value.planType, (item) => plans.has(item))
    && nullable(value.primary, window) && nullable(value.secondary, window)
    && nullable(value.credits, credits) && nullable(value.individualLimit, spend)
    && nullable(value.rateLimitReachedType, (item) => reachedTypes.has(item))
    && nullable(value.spendControlReached, (item) => typeof item === 'boolean');
}

export function validateInitializeResponse(value, version, { codexHome } = {}) {
  requireValid(object(value) && ['codexHome', 'platformFamily', 'platformOs', 'userAgent']
    .every((key) => text(value[key])) && path.isAbsolute(value.codexHome)
    && new RegExp(`(?:^|[^0-9.])${version.replaceAll('.', '\\.')}($|[^0-9.])`).test(value.userAgent)
    && (codexHome === undefined || value.codexHome === codexHome),
  'Invalid initialization metadata or installed version');
  return value;
}

export function validateThread(thread, { model, cwd, version = '0.156.1' }) {
  requireValid(object(thread) && id(thread.id) && thread.cliVersion === version
    && thread.cwd === cwd && thread.modelProvider === 'openai'
    && Number.isSafeInteger(thread.createdAt) && thread.createdAt >= 0
    && Number.isSafeInteger(thread.updatedAt) && thread.updatedAt >= 0
    && typeof thread.ephemeral === 'boolean' && typeof thread.preview === 'string'
    && ('projectId' in thread) && (thread.projectId === null || typeof thread.projectId === 'string')
    && text(thread.sessionId) && thread.source === 'appServer'
    && Array.isArray(thread.turns) && thread.turns.length === 0
    && (thread.model == null || thread.model === model)
    && (thread.reasoningEffort == null || thread.reasoningEffort === 'high'),
  'Effective session settings or identity differ');
  validateThreadStatus(thread.status, { phase: 'starting-session' });
  return thread;
}

export function validateThreadStartResponse(value, context) {
  requireValid(object(value) && value.model === context.model && value.cwd === context.cwd
    && value.modelProvider === 'openai' && value.approvalPolicy === 'never'
    && value.approvalsReviewer === 'auto_review'
    && keys(value.sandbox, ['type', 'networkAccess']) && value.sandbox.type === 'readOnly'
    && (value.sandbox.networkAccess === undefined || value.sandbox.networkAccess === false)
    // Optional in the schema; this approved experiment requires explicit observed high effort.
    && value.reasoningEffort === 'high'
    // Native schema defaults are [] and false; null has no such default.
    && (value.instructionSources === undefined || (Array.isArray(value.instructionSources)
      && value.instructionSources.length === 0)), 'Effective session settings or identity differ');
  validateThread(value.thread, context);
  return value;
}

export function validateTurnStartResponse(value) {
  const turn = value?.turn;
  requireValid(object(turn) && id(turn.id) && turn.status === 'inProgress'
    && (turn.itemsView === undefined || turn.itemsView === 'full') && Array.isArray(turn.items)
    && turn.items.every((item) => {
      if (!object(item) || !id(item.id)) return false;
      if (item.type === 'userMessage') return Array.isArray(item.content)
        && item.content.every((input) => object(input) && input.type === 'text'
          && typeof input.text === 'string'
          && (input.text_elements === undefined || (Array.isArray(input.text_elements)
            && input.text_elements.length === 0)));
      return item.type === 'reasoning' && ['summary', 'content'].every((field) =>
        item[field] === undefined || (Array.isArray(item[field])
          && item[field].every((part) => typeof part === 'string')));
    }), 'Invalid turn start response');
  return value;
}

export function validateThreadStatus(status, { phase }) {
  requireValid(keys(status, status?.type === 'active' ? ['type', 'activeFlags'] : ['type'])
    && (['idle', 'notLoaded'].includes(status.type) || (phase === 'turn-active'
      && status.type === 'active' && Array.isArray(status.activeFlags) && status.activeFlags.length === 0)),
  'Invalid or active-control thread status');
  return status;
}

function validateNotificationEnvelope(event, phase) {
  requireValid(phases.has(phase) && keys(event, ['method', 'params', 'emittedAtMs'])
    && object(event.params) && (event.emittedAtMs === undefined
      || (Number.isSafeInteger(event.emittedAtMs) && event.emittedAtMs >= 0)),
  'Malformed passive notification');
}

export function validateThreadStatusNotification(event, { phase, threadId } = {}) {
  validateNotificationEnvelope(event, phase);
  requireValid(event.method === 'thread/status/changed'
    && keys(event.params, ['threadId', 'status']) && id(event.params.threadId)
    && (threadId === undefined || threadId === event.params.threadId), 'Notification identity drift');
  validateThreadStatus(event.params.status, { phase });
  return event.params.threadId;
}

export function acceptPassiveNotification(event, { phase } = {}) {
  if (!['account/updated', 'remoteControl/status/changed', 'account/rateLimits/updated']
    .includes(event?.method)) return false;
  validateNotificationEnvelope(event, phase);
  const value = event.params;
  if (event.method === 'account/updated') {
    // Missing/null auth is schema-valid but does not establish this experiment's approved login.
    requireValid(keys(value, ['authMode', 'planType']) && value.authMode === 'chatgpt'
      && (value.planType === undefined || value.planType === null || plans.has(value.planType)),
    'Account metadata differs from approved context');
  } else if (event.method === 'account/rateLimits/updated') {
    requireValid(keys(value, ['rateLimits']) && validRateLimitSnapshot(value.rateLimits),
      'Malformed rate-limit metadata');
  } else {
    requireValid(keys(value, ['installationId', 'serverName', 'status', 'environmentId'])
      && text(value.installationId) && text(value.serverName) && value.status === 'disabled'
      && (value.environmentId === undefined || value.environmentId === null),
    'Remote-control metadata is malformed or not disabled');
  }
  return true;
}
