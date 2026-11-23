const { sampleMemory } = require("../../scripts/runtime-memory-telemetry.cjs");
setInterval(() => console.log(JSON.stringify(sampleMemory())), 1000).unref();
