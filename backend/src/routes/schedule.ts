import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const baseSchema = z.object({
  title: z.string().min(1),
  userId: z.coerce.number(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
  notes: z.string().max(280).optional(),
});

router.use(authenticate);

router.get('/mine', async (req: AuthenticatedRequest, res, next) => {
  try {
    const entries = await prisma.scheduleEntry.findMany({
      where: { userId: req.user!.id },
      orderBy: { start: 'asc' },
      take: 50,
    });

    return res.json(entries);
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const querySchema = z.object({
      start: z.string().datetime({ offset: true }).optional(),
      end: z.string().datetime({ offset: true }).optional(),
    });

    const { start, end } = querySchema.parse(req.query);

    const entries = await prisma.scheduleEntry.findMany({
      where: {
        ...(start ? { end: { gte: new Date(start) } } : {}),
        ...(end ? { start: { lte: new Date(end) } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { start: 'asc' },
    });

    return res.json(entries);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const payload = baseSchema.parse(req.body);

    const entry = await prisma.scheduleEntry.create({
      data: {
        title: payload.title,
        userId: payload.userId,
        start: new Date(payload.start),
        end: new Date(payload.end),
        color: payload.color,
        notes: payload.notes,
      },
    });

    return res.status(201).json(entry);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid schedule id' });
    }

    const payload = baseSchema.partial().parse(req.body);

    const entry = await prisma.scheduleEntry.update({
      where: { id },
      data: {
        ...payload,
        ...(payload.start ? { start: new Date(payload.start) } : {}),
        ...(payload.end ? { end: new Date(payload.end) } : {}),
      },
    });

    return res.json(entry);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid schedule id' });
    }

    await prisma.scheduleEntry.delete({ where: { id } });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
