// node:sqlite is stable enough for this app but still prints an ExperimentalWarning on load.
// Imported first so the warning doesn't clutter the console.
const emit = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const msg = typeof warning === 'string' ? warning : warning.message;
  if (/SQLite is an experimental feature/.test(msg)) return;
  return (emit as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;
