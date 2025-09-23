import { Router } from 'express';
import { Role, ShiftStatus } from '@prisma/client';
import { differenceInMinutes, parseISO } from 'date-fns';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const openShiftSchema = z.object({
  expectedEnd: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(280).optional(),
  openedAt: z.string().datetime({ offset: true }).optional(),
});

const closeShiftSchema = z.object({
  closedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(280).optional(),
});

router.use(authenticate);

router.get('/mine', async (req: AuthenticatedRequest, res, next) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { userId: req.user!.id },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });

    return res.json(shifts);
  } catch (error) {
    return next(error);
  }
});

router.get('/', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const rangeSchema = z.object({
      start: z.string().datetime({ offset: true }).optional(),
      end: z.string().datetime({ offset: true }).optional(),
      userId: z.coerce.number().optional(),
    });

    const { start, end, userId } = rangeSchema.parse(req.query);

    const where = {
      ...(start ? { openedAt: { gte: new Date(start) } } : {}),
      ...(end ? { openedAt: { lte: new Date(end) } } : {}),
      ...(userId ? { userId } : {}),
    };

    const shifts = await prisma.shift.findMany({
      where,
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
      orderBy: { openedAt: 'desc' },
    });

    return res.json(shifts);
  } catch (error) {
    return next(error);
  }
});

router.post('/open', async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = openShiftSchema.parse(req.body);

    const existing = await prisma.shift.findFirst({
      where: { userId: req.user!.id, status: ShiftStatus.OPEN },
    });

    if (existing) {
      return res.status(409).json({
        error: 'ConflictError',
        message: 'You already have an open shift',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    }

    const openedAt = payload.openedAt ? parseISO(payload.openedAt) : new Date();

    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        openedAt,
        expectedEnd: payload.expectedEnd ? parseISO(payload.expectedEnd) : undefined,
        notes: payload.notes,
        hourlyRate: user.hourlyRate,
      },
    });

    return res.status(201).json(shift);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/close', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id: idParam } = req.params;
    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid shift id' });
    }

    const payload = closeShiftSchema.parse(req.body);

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!shift) {
      return res.status(404).json({ error: 'NotFound', message: 'Shift not found' });
    }

    if (req.user!.role !== Role.ADMIN && shift.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Cannot close shifts for other users' });
    }

    if (shift.status === ShiftStatus.CLOSED) {
      return res.status(409).json({ error: 'ConflictError', message: 'Shift is already closed' });
    }

    const closedAt = payload.closedAt ? parseISO(payload.closedAt) : new Date();
    const minutesWorked = Math.max(differenceInMinutes(closedAt, shift.openedAt), 1);
    const hoursWorked = minutesWorked / 60;
    const payout = Number(shift.hourlyRate) * hoursWorked;

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt,
        minutesWorked,
        payout,
        notes: payload.notes ?? shift.notes,
      },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

export default router;
