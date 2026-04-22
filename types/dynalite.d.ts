declare module "dynalite" {
  interface DynaliteOptions {
    createTableMs?: number;
    deleteTableMs?: number;
    path?: string;
  }

  interface DynaliteAddress {
    port: number;
  }

  interface DynaliteServer {
    listen(port: number, cb: (err?: Error) => void): void;
    address(): DynaliteAddress;
    close(cb: () => void): void;
  }

  function dynalite(options?: DynaliteOptions): DynaliteServer;

  namespace dynalite {
    export type { DynaliteOptions, DynaliteAddress, DynaliteServer };
  }

  export = dynalite;
}
