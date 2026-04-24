import { createExtensions } from "~/index.js";
import { OnNdJsonError } from "./OnNdJsonError/OnNdJsonError.ts";
import { OnRecordModify } from "./OnRecordModify/OnRecordModify.ts";
import { OnWriteLog } from "./OnWriteLog/OnWriteLog.js";

export default createExtensions(({ container }) => {
  container.register(OnNdJsonError);
  container.register(OnRecordModify);
  container.register(OnWriteLog);
});
