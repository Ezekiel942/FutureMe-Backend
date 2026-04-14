"use strict";
/**
 * Session Module Tests
 * Tests work session lifecycle: start, pause, resume, end
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("../../src/app");
const supertest_1 = __importDefault(require("supertest"));
describe('Session Module', () => {
    let app;
    let authToken;
    let userId;
    let organizationId;
    beforeAll(async () => {
        app = (0, app_1.createApp)();
        // Register test user
        const registerRes = await (0, supertest_1.default)(app).post('/api/auth/register').send({
            email: 'session-test@example.com',
            password: 'Test123!@#',
            firstName: 'Session',
            lastName: 'Test',
        });
        authToken = registerRes.body.data.token;
        userId = registerRes.body.data.user.id;
        organizationId = registerRes.body.data.user.organizationId;
    });
    describe('POST /api/v1/sessions/start', () => {
        it('should start a new work session', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/v1/sessions/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                projectId: 'proj-123',
                taskId: 'task-456',
                description: 'Working on feature X',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('sessionId');
            expect(res.body.data).toHaveProperty('startTime');
            expect(res.body.data.status).toBe('active');
        });
        it('should reject session start without authentication', async () => {
            const res = await (0, supertest_1.default)(app).post('/api/v1/sessions/start').send({
                projectId: 'proj-123',
                taskId: 'task-456',
            });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /api/v1/sessions/{id}/pause', () => {
        let sessionId;
        beforeAll(async () => {
            // Create a session to pause
            const startRes = await (0, supertest_1.default)(app)
                .post('/api/v1/sessions/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                projectId: 'proj-123',
                taskId: 'task-456',
            });
            sessionId = startRes.body.data.sessionId;
        });
        it('should pause an active session', async () => {
            const res = await (0, supertest_1.default)(app)
                .post(`/api/v1/sessions/${sessionId}/pause`)
                .set('Authorization', `Bearer ${authToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('paused');
            expect(res.body.data).toHaveProperty('pausedAt');
        });
        it('should reject pause on already paused session', async () => {
            const res = await (0, supertest_1.default)(app)
                .post(`/api/v1/sessions/${sessionId}/pause`)
                .set('Authorization', `Bearer ${authToken}`);
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /api/v1/sessions/{id}/resume', () => {
        let sessionId;
        beforeAll(async () => {
            const startRes = await (0, supertest_1.default)(app)
                .post('/api/v1/sessions/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                projectId: 'proj-123',
                taskId: 'task-456',
            });
            sessionId = startRes.body.data.sessionId;
            // Pause the session
            await (0, supertest_1.default)(app)
                .post(`/api/v1/sessions/${sessionId}/pause`)
                .set('Authorization', `Bearer ${authToken}`);
        });
        it('should resume a paused session', async () => {
            const res = await (0, supertest_1.default)(app)
                .post(`/api/v1/sessions/${sessionId}/resume`)
                .set('Authorization', `Bearer ${authToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('active');
        });
    });
    describe('POST /api/v1/sessions/{id}/end', () => {
        let sessionId;
        beforeAll(async () => {
            const startRes = await (0, supertest_1.default)(app)
                .post('/api/v1/sessions/start')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                projectId: 'proj-123',
                taskId: 'task-456',
            });
            sessionId = startRes.body.data.sessionId;
        });
        it('should end an active session', async () => {
            const res = await (0, supertest_1.default)(app)
                .post(`/api/v1/sessions/${sessionId}/end`)
                .set('Authorization', `Bearer ${authToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('completed');
            expect(res.body.data).toHaveProperty('endTime');
            expect(res.body.data).toHaveProperty('durationSeconds');
        });
    });
    describe('GET /api/v1/sessions/active', () => {
        it('should retrieve active sessions for user', async () => {
            const res = await (0, supertest_1.default)(app)
                .get('/api/v1/sessions/active')
                .set('Authorization', `Bearer ${authToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
        it('should enforce tenant isolation on sessions', async () => {
            const res = await (0, supertest_1.default)(app)
                .get('/api/v1/sessions/active')
                .set('Authorization', `Bearer ${authToken}`);
            // All sessions should belong to user's organization
            res.body.data.forEach((session) => {
                expect(session.organizationId).toBe(organizationId);
            });
        });
    });
});
