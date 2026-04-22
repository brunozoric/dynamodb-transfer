import { createFeature } from "~/base/index.ts";
import { Prompter } from "./Prompter.ts";

export const PrompterFeature = createFeature({
    name: "Ui/PrompterFeature",
    register(container) {
        container.register(Prompter).inSingletonScope();
    }
});
