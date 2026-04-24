import { createExtensions } from "~/index.js";
import { OnNdJsonError } from "./OnNdJsonError/OnNdJsonError.ts";
import { OnRecordModify } from "./OnRecordModify/OnRecordModify.ts";

export default createExtensions(({ container }) => {
  container.register(OnNdJsonError);
  container.register(OnRecordModify);
});
