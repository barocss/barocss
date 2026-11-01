/** Shared constructor for root and ancillary package entries. */
export class PhysicsError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.name = 'PhysicsError';
        this.details = { code, reason: message, operation: 'create', phase: 'admission', domain: 'world', entityIds: [], accepted: null, ...details };
    }
}
