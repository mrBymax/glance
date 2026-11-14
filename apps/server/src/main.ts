import { buildApp } from './app';
import { systemClock } from './clock';
import { ConfigError, loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig(process.env, process.argv.slice(2));
  const app = await buildApp({ config, clock: systemClock });

  let closing = false;
  const close = (signal: string): void => {
    if (closing) return;
    closing = true;
    app.log.info(`${signal} received, closing`);
    app.close().then(() => process.exit(0), (error) => {
      app.log.error(error);
      process.exit(1);
    });
  };
  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT', () => close('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.port });
  app.log.info(`listening on :${config.port}`);
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    console.error(`config: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
