import { WriteLogMapper as WriteLogMapperAbstraction } from "./abstractions/index.ts";

class WriteLogMapperImpl implements WriteLogMapperAbstraction.Interface {
    public async map(
        options: WriteLogMapperAbstraction.MapOptions
    ): Promise<Record<string, unknown>> {
        return options.keys;
    }
}

export const WriteLogMapper = WriteLogMapperAbstraction.createImplementation({
    implementation: WriteLogMapperImpl,
    dependencies: []
});
