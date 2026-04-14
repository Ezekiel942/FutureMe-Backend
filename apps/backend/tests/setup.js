"use strict";
/**
 * Jest Test Setup / Global Configuration
 * This file runs before all tests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env files before tests
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env.example'), override: true });
beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '2200';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long!!';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});
// Suppress console logs during tests (optional)
// global.console.log = jest.fn();
// global.console.warn = jest.fn();
// global.console.error = jest.fn();
// Mock external dependencies if needed
jest.mock('../src/infrastructure/monitoring/sentry', () => ({
    initializeSentry: jest.fn(),
    setupGlobalErrorHandlers: jest.fn(),
    sentryErrorMiddleware: (err, req, res, next) => next(err),
}));
jest.mock('../src/infrastructure/redis', () => ({
    initializeRedis: jest.fn().mockResolvedValue(true),
    getRedisClient: jest.fn().mockReturnValue(null),
    isRedisAvailable: jest.fn().mockReturnValue(false),
}));
jest.mock('../src/infrastructure/ai/openai', () => {
    const base = {
        isAvailable: jest.fn().mockReturnValue(false),
        analyzeBurnoutRisk: jest.fn().mockResolvedValue({ success: true, data: { score: 50, riskLevel: 'medium', recommendations: ['Take breaks'] } }),
        generateCoaching: jest.fn().mockResolvedValue({ success: true, data: 'Default coaching advice.' }),
        analyzeAttendance: jest.fn().mockResolvedValue({ success: true, data: { anomalies: [], patterns: ['consistent'] } }),
        analyzeProjectRisk: jest.fn().mockResolvedValue({ success: true, data: { riskScore: 20, issues: [], recommendations: [] } }),
        generateExecutiveSummary: jest.fn().mockResolvedValue({ success: true, data: {} }),
        generateWorkforceReassignment: jest.fn().mockResolvedValue({ success: true, data: {} }),
        generateRecommendations: jest.fn().mockResolvedValue({ success: true, data: {} }),
        generateCompletion: jest.fn().mockResolvedValue({ success: true, data: '' }),
        generateWorkCoachSuggestions: jest.fn().mockResolvedValue({ success: true, data: { suggestions: [] } }),
        fallbackBurnoutAnalysis: jest.fn().mockReturnValue({ success: true, data: { burnoutScore: 50 } }),
        fallbackCoaching: jest.fn().mockReturnValue({ success: true, data: { coachingTips: ['Use breaks'] } }),
        fallbackAttendanceAnalysis: jest.fn().mockReturnValue({ success: true, data: { anomalies: [], patterns: [] } }),
        fallbackWorkforceReassignment: jest.fn().mockReturnValue({ success: true, data: { overloadedUsers: [], underutilizedUsers: [] } }),
        fallbackExecutiveSummary: jest.fn().mockReturnValue({ success: true, data: {} }),
        fallbackScopeCreepAnalysis: jest.fn().mockReturnValue({ success: true, data: {} }),
        generateFallbackRecommendations: jest.fn().mockReturnValue({ success: true, data: {} }),
    };
    return {
        __esModule: true,
        default: base,
        openaiService: base,
    };
});
jest.mock('socket.io', () => {
    return {
        Server: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            emit: jest.fn(),
            close: jest.fn(),
        })),
    };
});
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
    }),
}));
// Mock database models since typeorm is not used in testing
jest.mock('../src/database/models/User.model', () => ({
    User: jest.fn(),
    findUserByEmail: jest.fn().mockResolvedValue(null),
    createUser: jest.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com' }),
}));
jest.mock('../src/database/models/WorkSession.model', () => ({
    WorkSession: jest.fn(),
    findSessionsByUser: jest.fn().mockResolvedValue([]),
    findSessionsByOrganization: jest.fn().mockResolvedValue([]),
    createSession: jest.fn().mockResolvedValue({ id: 'session-123' }),
}));
jest.mock('../src/database/models/RiskEvent.model', () => ({
    RiskEvent: jest.fn(),
    createRiskEvent: jest.fn().mockResolvedValue({ id: 'risk-123' }),
}));
jest.mock('../src/database/models/PasswordReset.model', () => ({
    PasswordReset: jest.fn(),
    createPasswordReset: jest.fn().mockResolvedValue({ token: 'token-123' }),
    verifyPasswordReset: jest.fn().mockResolvedValue({ token: 'token-123' }),
}));
jest.mock('../src/database/models/RefreshToken.model', () => ({
    RefreshToken: jest.fn(),
    createRefreshToken: jest.fn().mockResolvedValue({ token: 'refresh-123' }),
    verifyRefreshToken: jest.fn().mockResolvedValue({ token: 'refresh-123' }),
}));
jest.mock('../src/database/models/AuditEntry.model', () => ({
    AuditEntry: jest.fn(),
    createAuditEntry: jest.fn().mockResolvedValue({ id: 'audit-123' }),
}));
jest.mock('../src/database/models/CustomTenantRules.model', () => ({
    CustomTenantRules: jest.fn(),
    getCustomRules: jest.fn().mockResolvedValue({}),
    setCustomRules: jest.fn().mockResolvedValue({}),
}));
// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
    }),
}));
