// Local load-test instrumentation only; never preload into production.
if (!process.argv.includes("127.0.0.1")) throw new Error("Memory probe requires an explicit loopback server");
setInterval(() => console.log(JSON.stringify({ type: "local-memory", at: new Date().toISOString(), pid: process.pid, ...process.memoryUsage() })), 5000).unref();
