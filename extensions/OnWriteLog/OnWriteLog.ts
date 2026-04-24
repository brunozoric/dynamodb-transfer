import { WriteLogMapper } from "~/index.js";

class OnWriteLogImpl implements WriteLogMapper.Interface {
  public async map(options: WriteLogMapper.MapOptions): Promise<Record<string, unknown>> {
    const { record, tableName, keys } = options;
    return keys;
  }
}

export const OnWriteLog = Object.assign(
  WriteLogMapper.createImplementation({
    implementation: OnWriteLogImpl,
    dependencies: []
  }),
  {
    meta: {
      id: "writeLogMapper",
      name: "Write log mapper",
      description: "Customise what is logged per written record"
    }
  }
);
