import { Session as SessionAbstraction } from "./abstractions/index.ts";

class SessionImpl implements SessionAbstraction.Interface {
    private readonly data: Partial<SessionAbstraction.Data> = {};

    public set<K extends keyof SessionAbstraction.Data>(
        key: K,
        value: SessionAbstraction.Data[K]
    ): void {
        this.data[key] = value;
    }

    public get<K extends keyof SessionAbstraction.Data>(
        key: K
    ): SessionAbstraction.Data[K] | undefined {
        return this.data[key];
    }

    public snapshot(): Readonly<Partial<SessionAbstraction.Data>> {
        return { ...this.data };
    }
}

export const Session = SessionAbstraction.createImplementation({
    implementation: SessionImpl,
    dependencies: []
});
