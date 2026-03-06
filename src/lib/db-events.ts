type DbEventType =
  | "transactions-changed"
  | "categories-changed"
  | "recurring-changed"
  | "settings-changed"
  | "tags-changed"
  | "cashflow-changed";

const bus = new EventTarget();

export function emitDbEvent(type: DbEventType) {
  bus.dispatchEvent(new Event(type));
}

export function onDbEvent(type: DbEventType, handler: () => void): () => void {
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}
