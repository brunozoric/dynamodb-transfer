import { createExtensions } from "~/index.js";
import { OnNdJsonError } from "./OnNdJsonError/OnNdJsonError.ts";

export default createExtensions(({ container }) => {
  container.register(OnNdJsonError);
});
