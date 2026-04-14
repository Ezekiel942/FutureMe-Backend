/**
 * Jest Test Setup / Global Configuration
 * This file runs before all tests
 */

import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load .env files before tests
dotenv.config({ path: path.resolve(__dirname, '../.env.example'), override: true });

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
  sentryErrorMiddleware: (err: any, req: any, res: any, next: any) => next(err),
}));

jest.mock('../src/infrastructure/redis', () => ({
  initializeRedis: jest.fn().mockResolvedValue(true),
  getRedisClient: jest.fn().mockReturnValue(null),
  isRedisAvailable: jest.fn().mockReturnValue(false),
}));

jest.mock('../src/infrastructure/ai/openai', () => {
  const base = {
    isAvailable: jest.fn().mockReturnValue(false),
    analyzeBurnoutRisk: jest
      .fn()
      .mockResolvedValue({
        success: true,
        data: { score: 50, riskLevel: 'medium', recommendations: ['Take breaks'] },
      }),
    generateCoaching: jest
      .fn()
      .mockResolvedValue({ success: true, data: 'Default coaching advice.' }),
    analyzeAttendance: jest
      .fn()
      .mockResolvedValue({ success: true, data: { anomalies: [], patterns: ['consistent'] } }),
    analyzeProjectRisk: jest
      .fn()
      .mockResolvedValue({
        success: true,
        data: { riskScore: 20, issues: [], recommendations: [] },
      }),
    generateExecutiveSummary: jest.fn().mockResolvedValue({ success: true, data: {} }),
    generateWorkforceReassignment: jest.fn().mockResolvedValue({ success: true, data: {} }),
    generateRecommendations: jest.fn().mockResolvedValue({ success: true, data: {} }),
    generateCompletion: jest.fn().mockResolvedValue({ success: true, data: '' }),
    generateWorkCoachSuggestions: jest
      .fn()
      .mockResolvedValue({ success: true, data: { suggestions: [] } }),
    fallbackBurnoutAnalysis: jest
      .fn()
      .mockReturnValue({ success: true, data: { burnoutScore: 50 } }),
    fallbackCoaching: jest
      .fn()
      .mockReturnValue({ success: true, data: { coachingTips: ['Use breaks'] } }),
    fallbackAttendanceAnalysis: jest
      .fn()
      .mockReturnValue({ success: true, data: { anomalies: [], patterns: [] } }),
    fallbackWorkforceReassignment: jest
      .fn()
      .mockReturnValue({ success: true, data: { overloadedUsers: [], underutilizedUsers: [] } }),
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

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
}));

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
const hashedTestPassword = bcrypt.hashSync('Test123!@#', 10);
const testUsers: Record<string, any> = {};

jest.mock('../src/database/models/User.model', () => ({
  User: jest.fn(),
  findUserByEmail: jest.fn().mockImplementation(async (email: string) => {
    return testUsers[email] || null;
  }),
  findById: jest.fn().mockImplementation(async (id: string) => {
    return Object.values(testUsers).find((user) => user.id === id) || null;
  }),
  createUser: jest.fn().mockImplementation(async (payload: any) => {
    const user = {
      id: payload.id || `user-${Object.keys(testUsers).length + 1}`,
      firstName: payload.firstName || 'Test',
      lastName: payload.lastName || 'User',
      email: payload.email || 'test@example.com',
      role: payload.role || 'user',
      organizationId: payload.organizationId || 'org-123',
      passwordHash: hashedTestPassword,
      ...payload,
    };
    testUsers[user.email] = user;
    return user;
  }),
}));

const sessionStore: Record<string, any> = {};

jest.mock('../src/database/models/WorkSession.model', () => ({
  WorkSession: jest.fn(),
  findSessionsByUser: jest.fn().mockImplementation(async (userId: string) => {
    return Object.values(sessionStore).filter((s: any) => s.userId === userId);
  }),
  findSessionsByOrganization: jest.fn().mockImplementation(async (organizationId: string) => {
    return Object.values(sessionStore).filter((s: any) => s.organizationId === organizationId);
  }),
  findSessionById: jest.fn().mockImplementation(async (sessionId: string) => {
    return sessionStore[sessionId] || null;
  }),
  createSession: jest.fn().mockImplementation(async (payload: any) => {
    const newSession = {
      id: payload.id || `session-${Date.now()}`,
      userId: payload.userId,
      projectId: payload.projectId || null,
      taskId: payload.taskId || null,
      startTime: payload.startTime || new Date().toISOString(),
      durationSeconds: payload.durationSeconds || null,
      endTime: payload.endTime || null,
      meta: payload.meta || {},
      organizationId: payload.organizationId || 'org-123',
    };
    sessionStore[newSession.id] = newSession;
    return newSession;
  }),
  updateSession: jest.fn().mockImplementation(async (sessionId: string, update: any) => {
    if (!sessionStore[sessionId]) return null;
    sessionStore[sessionId] = { ...sessionStore[sessionId], ...update };
    return sessionStore[sessionId];
  }),
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
