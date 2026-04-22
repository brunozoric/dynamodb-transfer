import type { Container } from "@webiny/di";

type FeatureDefinition<TCtx = void> = [TCtx] extends [void]
    ? { name: string; register(container: Container): void }
    : { name: string; register(container: Container, context: TCtx): void };

export function createFeature<TCtx = void>(def: FeatureDefinition<TCtx>): FeatureDefinition<TCtx> {
    Reflect.defineMetadata("wby:isFeature", true, def);
    return def;
}
