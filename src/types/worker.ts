export interface DbWorkerRequest {
  id: number;
  type: "exec";
  sql: string;
  params?: unknown[];
}

export interface DbWorkerResponse {
  id: number;
  type: "result" | "error" | "ready";
  rows?: unknown[];
  changes?: number;
  error?: string;
  storageType?: string;
}
