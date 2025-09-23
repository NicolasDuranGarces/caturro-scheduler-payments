import { Router } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
  hourlyRate: z.coerce.number().positive(),
  notes: z.string().max(280).optional(),
});

const updateUserSchema = createUserSchema.
  partial().
  extend({
    password: z.string().min(8).optional(),
    status: z.nativeEnum(UserStatus).optional(),
  });

router.use(authenticate);

router.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        hourlyRate: true,
        status: true,
        notes: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

router.get('/', authorize([Role.ADMIN]), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        hourlyRate: true,
        status: true,
        notes: true,
        createdAt: true,
      },
    });

    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const password = await hashPassword(payload.password);

    const created = await prisma.user.create({
      data: {
        email: payload.email,
        password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        hourlyRate: payload.hourlyRate,
        notes: payload.notes,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        hourlyRate: true,
        status: true,
        notes: true,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid user id' });
    }

    const data = updateUserSchema.parse(req.body);
    const { password, ...rest } = data;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { password: await hashPassword(password) } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        hourlyRate: true,
        status: true,
        notes: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

export default router;
