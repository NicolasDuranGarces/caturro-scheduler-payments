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

router.get('/summary', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const rangeSchema = z.object({
      start: z.string().datetime({ offset: true }).optional(),
      end: z.string().datetime({ offset: true }).optional(),
    });

    const { start, end } = rangeSchema.parse(req.query);

    const where = {
      status: ShiftStatus.CLOSED,
      ...(start ? { closedAt: { gte: new Date(start) } } : {}),
      ...(end ? { closedAt: { lte: new Date(end) } } : {}),
    };

    const grouped = await prisma.shift.groupBy({
      by: ['userId'],
      where,
      _sum: {
        payout: true,
        minutesWorked: true,
      },
      _count: {
        _all: true,
      },
    });

    if (!grouped.length) {
      return res.json([]);
    }

    const paymentWhere = {
      userId: { in: grouped.map((item) => item.userId) },
      ...(start ? { periodEnd: { gte: new Date(start) } } : {}),
      ...(end ? { periodStart: { lte: new Date(end) } } : {}),
    } as const;

    const paymentTotals = await prisma.paymentRecord.groupBy({
      by: ['userId'],
      where: paymentWhere,
      _sum: {
        amount: true,
      },
    });

    const paidMap = new Map(paymentTotals.map((item) => [item.userId, item._sum.amount ? Number(item._sum.amount) : 0]));

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((item) => item.userId) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        hourlyRate: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));

    const summary = grouped.map((item) => {
      const info = userMap.get(item.userId);
      const minutes = Number(item._sum.minutesWorked ?? 0);
      const payout = item._sum.payout ? Number(item._sum.payout) : 0;
      const paidAmount = paidMap.get(item.userId) ?? 0;
      return {
        userId: item.userId,
        user: info ?? null,
        shifts: item._count._all,
        minutesWorked: minutes,
        hoursWorked: minutes / 60,
        payout,
        paid: paidAmount,
        pending: Math.max(payout - paidAmount, 0),
      };
    });

    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});

const paymentBodySchema = z.object({
  userId: z.number(),
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  amount: z.coerce.number().nonnegative(),
  notes: z.string().max(280).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
});

router.get('/payment-history', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const querySchema = z.object({
      start: z.string().datetime({ offset: true }).optional(),
      end: z.string().datetime({ offset: true }).optional(),
      userId: z.coerce.number().optional(),
    });

    const { start, end, userId } = querySchema.parse(req.query);

    const payments = await prisma.paymentRecord.findMany({
      where: {
        ...(start ? { periodEnd: { gte: new Date(start) } } : {}),
        ...(end ? { periodStart: { lte: new Date(end) } } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: [
        { paidAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            hourlyRate: true,
          },
        },
      },
      take: 50,
    });

    return res.json(payments);
  } catch (error) {
    return next(error);
  }
});

router.post('/payment-history', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const payload = paymentBodySchema.parse(req.body);

    const created = await prisma.paymentRecord.create({
      data: {
        userId: payload.userId,
        periodStart: new Date(payload.periodStart),
        periodEnd: new Date(payload.periodEnd),
        amount: payload.amount,
        notes: payload.notes,
        paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            hourlyRate: true,
          },
        },
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.delete('/payment-history/:id', authorize([Role.ADMIN]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Invalid payment id' });
    }

    await prisma.paymentRecord.delete({ where: { id } });

    return res.status(204).send();
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
