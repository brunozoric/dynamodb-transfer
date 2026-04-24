import { WriteLogMapper } from "~/index.js";
import { Session } from "~/features/Session/index.js";

class OnWriteLogImpl implements WriteLogMapper.Interface {
  public constructor(private readonly session: Session.Interface) {}

  public async map(options: WriteLogMapper.MapOptions): Promise<Record<string, unknown> | null> {
    const { record, keys } = options;

    const sourcePath = this.session.get("sourcePath");
    if (!sourcePath || typeof sourcePath !== "string") {
      return null;
    }
    if (sourcePath.toLowerCase().includes("es.ndjson") === false) {
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
  dependencies: [Session]
});
