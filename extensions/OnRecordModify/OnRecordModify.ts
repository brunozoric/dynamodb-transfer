import { RecordModifier } from "~/index.js";

class OnRecordModifyImpl implements RecordModifier.Interface {
  public async modify(options: RecordModifier.ModifyOptions): Promise<Record<string, unknown>> {
    const { record, table, sourcePath } = options;

    const index = record.index as string | undefined;
    if (!index) {
      return record;
    }

    return {
      ...record,
      index: index.replace("wby-z0044zvw-", "")
    };
  }
}

export const OnRecordModify = RecordModifier.createImplementation({
  implementation: OnRecordModifyImpl,
  dependencies: []
});
