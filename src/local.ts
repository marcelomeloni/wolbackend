// Servidor local (dev / node tradicional).
// Na Vercel o entrypoint é `src/app.ts`, detectado automaticamente pela plataforma.
import app from './app';
import { env, integrationFlags } from './lib/env';

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
  console.log('Integrações ativas:', integrationFlags);
});
