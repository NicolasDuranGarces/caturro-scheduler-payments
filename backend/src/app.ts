import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import shiftRoutes from './routes/shifts';
import scheduleRoutes from './routes/schedule';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: env.APP_NAME, timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/schedule', scheduleRoutes);

// Allow reverse proxies that strip the /api prefix
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/shifts', shiftRoutes);
app.use('/schedule', scheduleRoutes);

app.use(errorHandler);

export default app;
