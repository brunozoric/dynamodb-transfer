import { RecordModifier } from "~/index.js";

class OnRecordModifyImpl implements RecordModifier.Interface {
  public async modify(
    options: RecordModifier.ModifyOptions
  ): Promise<Record<string, unknown> | null> {
    const { record } = options;

    const index = record?.index as string | undefined;
    if (!index) {
      return record;
    }

    if (index.includes("webinytask")) {
      return null;
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
