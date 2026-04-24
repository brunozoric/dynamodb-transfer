import { WriteLogMapper } from "~/index.js";

class OnWriteLogImpl implements WriteLogMapper.Interface {
  public async map(options: WriteLogMapper.MapOptions): Promise<Record<string, unknown> | null> {
    const { record, fileName, keys } = options;

    if (fileName.toLowerCase().includes("es.ndjson") === false) {
      return null;
    }

    const index = record?.index as string | undefined;
    if (typeof index !== "string") {
      return null;
    }

    return {
      ...keys,
      index
    };
  }
}

export const OnWriteLog = WriteLogMapper.createImplementation({
  implementation: OnWriteLogImpl,
  dependencies: []
});
