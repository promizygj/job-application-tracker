export class StorageNotFoundError extends Error {
  constructor(key) {
    super(`Stored file not found: ${key}`);
    this.key = key;
  }
}
