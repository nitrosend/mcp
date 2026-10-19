import { chmodSync } from "node:fs";

chmodSync(new URL("../dist/index.js", import.meta.url), 0o755);
