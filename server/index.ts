import path from 'node:path';
import { createSkyjoServer } from './app';

const port = Number(process.env.PORT ?? 4300);
const { httpServer, manager } = createSkyjoServer({ staticDir: path.resolve('client/dist') });
setInterval(() => manager.sweep(), 10 * 60 * 1000).unref();
httpServer.listen(port, () => console.log(`skyjo listening on :${port}`));
