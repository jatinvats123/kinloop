// Encodes a Firebase service-account JSON file as base64 and writes it to .env.local as
// FIREBASE_SERVICE_ACCOUNT, without printing the key. Usage: node scripts/encode-service-account.mjs <key.json>
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  process.stderr.write("Usage: node scripts/encode-service-account.mjs <path-to-key.json>\n");
  process.exit(1);
}

const json = JSON.parse(readFileSync(file, "utf8"));
if (!json.project_id || !json.client_email || !json.private_key) {
  process.stderr.write("That file is not a service-account key.\n");
  process.exit(1);
}

const line = `FIREBASE_SERVICE_ACCOUNT=${Buffer.from(JSON.stringify(json)).toString("base64")}`;
const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const next = /^FIREBASE_SERVICE_ACCOUNT=.*$/m.test(env)
  ? env.replace(/^FIREBASE_SERVICE_ACCOUNT=.*$/m, line)
  : `${env.trimEnd()}\n${line}\n`;
writeFileSync(".env.local", next);
process.stdout.write(
  `Saved FIREBASE_SERVICE_ACCOUNT for project ${json.project_id} to .env.local\n`,
);
