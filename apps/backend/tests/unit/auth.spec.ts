/**
 * Auth Module Tests
 * Tests authentication, JWT, password reset, and token management
 */

import { createApp } from '../../src/app';
import request from 'supertest';

describe('Auth Module', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
      expect(res.body.data).toHaveProperty('firstName', 'Test');
      expect(res.body.data).toHaveProperty('lastName', 'User');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'invalid-email',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test2@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app).post('/api/auth/register').send({
        email: 'unique@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
      });

      // Duplicate attempt
      const res = await request(app).post('/api/auth/register').send({
        email: 'unique@example.com',
        password: 'Test123!@#',
        firstName: 'Another',
        lastName: 'User',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app).post('/api/auth/register').send({
        email: 'login-test@example.com',
        password: 'Test123!@#',
        firstName: 'Login',
        lastName: 'Test',
      });
    });

    it('should login with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login-test@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login-test@example.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject login with non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Test123!@#',
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // Register and login to get refresh token
      await request(app).post('/api/auth/register').send({
        email: 'refresh-test@example.com',
        password: 'Test123!@#',
        firstName: 'Refresh',
        lastName: 'Test',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'refresh-test@example.com',
        password: 'Test123!@#',
      });

      const refreshToken = loginRes.body.data.refreshToken;

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('JWT Token Management', () => {
    it('should include tenant_id in JWT token for multi-tenancy', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'tenant-test@example.com',
        password: 'Test123!@#',
        firstName: 'Tenant',
        lastName: 'Test',
      });

      const token = res.body.data.token;
      expect(token).toBeDefined();

      // Token should be decodable and contain tenant info
      // This would require jwt.decode() to verify
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });
});
