import { RecordModifier } from "~/index.js";

class OnRecordModifyImpl implements RecordModifier.Interface {
  public async modify(options: RecordModifier.ModifyOptions): Promise<Record<string, unknown>> {
    const { record, table, sourcePath } = options;
    return record;
  }
}

export const OnRecordModify = RecordModifier.createImplementation({
  implementation: OnRecordModifyImpl,
  dependencies: []
});
