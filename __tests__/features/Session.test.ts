import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { Session, SessionFeature } from "~/features/Session/index.ts";
import type { Config } from "~/features/Config/index.ts";

function createSessionContainer(): Container {
    const container = new Container();
    SessionFeature.register(container);
    return container;
}

const sampleTable: Config.ResolvedTable = {
    name: "test-table",
    description: "Test table",
    writable: true,
    awsProfile: "test",
    region: "us-east-1"
};

describe("Session", () => {
    it("get on an unset key returns undefined", () => {
        const session = createSessionContainer().resolve(Session);
        expect(session.get("action")).toBeUndefined();
    });

    it("set then get roundtrip", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "download");
        expect(session.get("action")).toBe("download");
    });

    it("multiple keys are stored and retrieved independently", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "upload");
        session.set("segments", 4);
        expect(session.get("action")).toBe("upload");
        expect(session.get("segments")).toBe(4);
    });

    it("snapshot contains all set keys", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "download");
        session.set("segments", 2);
        expect(session.snapshot()).toEqual({ action: "download", segments: 2 });
    });

    it("snapshot is a deep copy — mutating the returned object does not affect subsequent snapshots", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("table", { ...sampleTable });
        const snap = session.snapshot();
        snap.table!.name = "mutated";
        expect(session.snapshot().table?.name).toBe("test-table");
    });

    it("snapshot on a fresh instance returns an empty object", () => {
        const session = createSessionContainer().resolve(Session);
        expect(session.snapshot()).toEqual({});
    });
});
