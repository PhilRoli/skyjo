import path from 'node:path';
import { createSkyjoServer } from './app';
import { createPersistence } from './persist';

const port = Number(process.env.PORT ?? 4400);
const { httpServer, io, manager, runner } = createSkyjoServer({
  staticDir: path.resolve('client/dist'),
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 900),
  devMode: process.env.DEV_MODE === '1',
});

const persistence = createPersistence(manager, path.resolve(process.env.DATA_DIR ?? 'data', 'rooms.json'));
console.log(`restored ${persistence.load()} room(s)`);
manager.onChange = persistence.schedule;
runner.resumeAll();

setInterval(() => {
  manager.sweep();
  runner.prune();
}, 10 * 60 * 1000).unref();

// Save before the sockets close, so the snapshot still reflects who was connected.
const shutdown = () => {
  runner.dispose();
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
