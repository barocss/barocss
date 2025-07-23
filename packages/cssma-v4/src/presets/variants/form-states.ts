import { staticModifier } from "../../core/registry";

// --- Form state variants ---
staticModifier('disabled', ['&:disabled'], { order: 40, source: 'pseudo' });
staticModifier('checked', ['&:checked'], { order: 40, source: 'pseudo' });
staticModifier('required', ['&:required'], { order: 40, source: 'pseudo' });
staticModifier('invalid', ['&:invalid'], { order: 40, source: 'pseudo' });
staticModifier('enabled', ['&:enabled'], { order: 40, source: 'pseudo' });
staticModifier('indeterminate', ['&:indeterminate'], { order: 40, source: 'pseudo' });
staticModifier('default', ['&:default'], { order: 40, source: 'pseudo' });
staticModifier('optional', ['&:optional'], { order: 40, source: 'pseudo' });
staticModifier('valid', ['&:valid'], { order: 40, source: 'pseudo' });
staticModifier('user-valid', ['&:user-valid'], { order: 40, source: 'pseudo' });
staticModifier('user-invalid', ['&:user-invalid'], { order: 40, source: 'pseudo' });
staticModifier('in-range', ['&:in-range'], { order: 40, source: 'pseudo' });
staticModifier('out-of-range', ['&:out-of-range'], { order: 40, source: 'pseudo' });
staticModifier('placeholder-shown', ['&:placeholder-shown'], { order: 40, source: 'pseudo' });
staticModifier('autofill', ['&:autofill'], { order: 40, source: 'pseudo' });
staticModifier('read-only', ['&:read-only'], { order: 40, source: 'pseudo' }); 