// Compatibility entry point for the daily automation. Implementation is tracked
// under scripts; JSON monitoring state stays in the working repository.
import { main } from "../../scripts/audit-public-links.mjs";
await main();
