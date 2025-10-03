declare module 'web3.storage' {
  export class Web3Storage {
    constructor(opts: { token: string });
    put(files: unknown[], options?: Record<string, unknown>): Promise<string>;
  }
}


