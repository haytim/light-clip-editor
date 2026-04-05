import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("src/renderer");
const destinationDir = path.resolve("dist/src/renderer");

await mkdir(destinationDir, { recursive: true });
await cp(path.join(sourceDir, "index.html"), path.join(destinationDir, "index.html"));
await cp(path.join(sourceDir, "styles.css"), path.join(destinationDir, "styles.css"));
