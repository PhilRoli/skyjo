import path from 'node:path';
import { createSkyjoServer } from './app';
import { createPersistence } from './persist';

const port = Number(process.env.PORT ?? 4400);
const { httpServer, io, manager } = createSkyjoServer({ staticDir: path.resolve('client/dist') });

const persistence = createPersistence(manager, path.resolve(process.env.DATA_DIR ?? 'data', 'rooms.json'));
console.log(`restored ${persistence.load()} room(s)`);
manager.onChange = persistence.schedule;

setInterval(() => manager.sweep(), 10 * 60 * 1000).unref();

// Save before the sockets close, so the snapshot still reflects who was connected.
const shutdown = () => {
  try {
    persistence.flush();
  } catch (e) {
    console.error('final persist failed', e);
  }
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

httpServer.listen(port, () => console.log(`skyjo listening on :${port}`));
