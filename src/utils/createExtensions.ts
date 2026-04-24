import type { Container } from "@webiny/di";

export interface ICreateExtensionsParams {
    container: Container;
}

export interface ICreateExtensionsCb {
    (params: ICreateExtensionsParams): void | Promise<void>;
}

export const createExtensions = (cb: ICreateExtensionsCb) => {
    return cb;
};
