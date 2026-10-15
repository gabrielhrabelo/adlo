import 'dotenv/config';
import { buildApp } from "./app.ts";

const app = buildApp()

await app.listen({ port: Number(process.env['PORT'] ?? 3333), host: '0.0.0.0' })
