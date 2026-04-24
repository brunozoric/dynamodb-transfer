import { createFeature } from "~/base/index.ts";
import { Session } from "./Session.ts";

export const SessionFeature = createFeature({
    name: "Core/SessionFeature",
    register(container) {
        container.register(Session).inSingletonScope();
    }
});
