export function fail(message: string) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

export function warn(message: string) {
  console.warn(`Warning: ${message}`);
}

