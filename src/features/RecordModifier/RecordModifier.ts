import { RecordModifier as RecordModifierAbstraction } from "./abstractions/index.ts";

class RecordModifierImpl implements RecordModifierAbstraction.Interface {
    public async modify(
        options: RecordModifierAbstraction.ModifyOptions
    ): Promise<Record<string, unknown>> {
        return options.record;
    }
}

export const RecordModifier = RecordModifierAbstraction.createImplementation({
    implementation: RecordModifierImpl,
    dependencies: []
});
