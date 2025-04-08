import request from 'supertest';
import express from 'express';
import workspaceRoutes from '../routes/workspace.route.js';
import prisma from '../config/test-database.js';

const app = express();
app.use(express.json());
app.use('/workspace', workspaceRoutes);

// Mock middleware
jest.mock('../middleware/Auth.middleware.js', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }
}));

jest.mock('../middleware/Role.middleware.js', () => ({
  __esModule: true,
  default: (roles: string[]) => (req: any, res: any, next: any) => {
    req.user.role = roles[0];
    next();
  }
}));

describe('Workspace Routes', () => {
  beforeAll(async () => {
    // Verify test database connection
    try {
      await prisma.$connect();
      console.log('Connected to test database');
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clear all tables in reverse order of dependencies
    await prisma.member.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.workspace.deleteMany();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.member.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /workspace/create', () => {
    it('should create a new workspace', async () => {
      const response = await request(app)
        .post('/workspace/create')
        .send({ name: 'Test Workspace' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('workspaceId');
      expect(response.body.data).toHaveProperty('joinCode');
    });

    it('should return 422 if name is missing', async () => {
      const response = await request(app)
        .post('/workspace/create')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message', 'Invalid data');
    });
  });

  describe('POST /workspace/join/:id', () => {
    it('should allow user to join workspace with valid join code', async () => {
      // First create a workspace
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .post(`/workspace/join/${workspace.id}`)
        .send({ joinCode: 'TEST123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Joined workspace successfully');
    });

    it('should return 422 if join code is invalid', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .post(`/workspace/join/${workspace.id}`)
        .send({ joinCode: 'INVALID' });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message', 'Workspace not found');
    });
  });

  describe('POST /workspace/leave/:id', () => {
    it('should allow user to leave workspace', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      await prisma.member.create({
        data: {
          userId: 'test-user-id',
          workspaceId: workspace.id,
          role: 'MEMBER'
        }
      });

      const response = await request(app)
        .post(`/workspace/leave/${workspace.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Left workspace successfully');
    });

    it('should return 422 if user is not a member', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .post(`/workspace/leave/${workspace.id}`);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message', 'Member not found');
    });
  });

  describe('GET /workspace/all', () => {
    it('should return all workspaces', async () => {
      await prisma.workspace.createMany({
        data: [
          { name: 'Workspace 1', joinCode: 'CODE1', userId: 'test-user-id' },
          { name: 'Workspace 2', joinCode: 'CODE2', userId: 'test-user-id' }
        ]
      });

      const response = await request(app)
        .get('/workspace/all');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /workspace/get-workspaces-for-user', () => {
    it('should return workspaces where user is owner or member', async () => {
      const workspace1 = await prisma.workspace.create({
        data: {
          name: 'Owned Workspace',
          joinCode: 'CODE1',
          userId: 'test-user-id'
        }
      });

      const workspace2 = await prisma.workspace.create({
        data: {
          name: 'Member Workspace',
          joinCode: 'CODE2',
          userId: 'other-user-id'
        }
      });

      await prisma.member.create({
        data: {
          userId: 'test-user-id',
          workspaceId: workspace2.id,
          role: 'MEMBER'
        }
      });

      const response = await request(app)
        .get('/workspace/get-workspaces-for-user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /workspace/get-workspace-members/:id', () => {
    it('should return all active members of a workspace', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      await prisma.member.createMany({
        data: [
          {
            userId: 'test-user-id',
            workspaceId: workspace.id,
            role: 'ADMIN'
          },
          {
            userId: 'other-user-id',
            workspaceId: workspace.id,
            role: 'MEMBER'
          }
        ]
      });

      const response = await request(app)
        .get(`/workspace/get-workspace-members/${workspace.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return 422 if workspace not found', async () => {
      const response = await request(app)
        .get('/workspace/get-workspace-members/non-existent-id');

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message', 'Workspace not found');
    });
  });

  describe('GET /workspace/:id', () => {
    it('should return workspace details', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .get(`/workspace/${workspace.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('name', 'Test Workspace');
    });

    it('should return 422 if workspace not found', async () => {
      const response = await request(app)
        .get('/workspace/non-existent-id');

      expect(response.status).toBe(422);
    });
  });

  describe('PUT /workspace/:id', () => {
    it('should update workspace name if user has admin/moderator role', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .put(`/workspace/${workspace.id}`)
        .send({ name: 'Updated Workspace' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('name', 'Updated Workspace');
    });

    it('should return 400 if name is missing', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .put(`/workspace/${workspace.id}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Name is required');
    });
  });

  describe('DELETE /workspace/:id', () => {
    it('should soft delete workspace if user has admin role', async () => {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          joinCode: 'TEST123',
          userId: 'test-user-id'
        }
      });

      const response = await request(app)
        .delete(`/workspace/${workspace.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Workspace deleted successfully');

      // Verify workspace is soft deleted
      const deletedWorkspace = await prisma.workspace.findUnique({
        where: { id: workspace.id }
      });
      expect(deletedWorkspace?.isActive).toBe(false);
    });

    it('should return 422 if workspace not found', async () => {
      const response = await request(app)
        .delete('/workspace/non-existent-id');

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('message', 'Workspace not found');
    });
  });
}); 