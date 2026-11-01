export class PhysicsError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PhysicsError';
    }
}
