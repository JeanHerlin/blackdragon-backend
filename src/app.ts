import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import routes from './routes';
import errorHandler from './middleware/errorHandler';

const app = express();

// Served before helmet's stricter defaults would matter for static assets — uploaded
// product images need to be embeddable in Messenger cards and loadable cross-origin
// from the frontend, so this stays outside the helmet/cors-gated /api surface.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(helmet());
app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { (req as any).rawBody = buf; } }));

app.use('/api', routes);

app.use(errorHandler);

export default app;
