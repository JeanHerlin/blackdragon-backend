import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import routes from './routes';
import errorHandler from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use(errorHandler);

export default app;
