import type { DbWorkerRequest, DbWorkerResponse } from "../types/worker.ts";

export class DbClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void }
  >();
  private readyPromise: Promise<string>;
  private _storageType = "unknown";

  constructor() {
    this.worker = new Worker(
      new URL("../../worker/db-worker.ts", import.meta.url),
      { type: "module" }
    );

    this.readyPromise = new Promise((resolve, reject) => {
      const handler = (event: MessageEvent<DbWorkerResponse>) => {
        if (event.data.id === -1) {
          if (event.data.type === "ready") {
            this._storageType = event.data.storageType ?? "unknown";
            resolve(this._storageType);
          } else if (event.data.type === "error") {
            reject(new Error(event.data.error));
          }
          return;
        }

        const pending = this.pending.get(event.data.id);
        if (!pending) return;
        this.pending.delete(event.data.id);

        if (event.data.type === "error") {
          pending.reject(new Error(event.data.error));
        } else {
          pending.resolve({
            rows: event.data.rows ?? [],
            changes: event.data.changes ?? 0,
          });
        }
      };

      this.worker.addEventListener("message", handler);
    });
  }

  get storageType() {
    return this._storageType;
  }

  async waitReady(): Promise<string> {
    return this.readyPromise;
  }

  async exec<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; changes: number }> {
    await this.readyPromise;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        id,
        type: "exec",
        sql,
        params,
      } satisfies DbWorkerRequest);
    });
  }
}
