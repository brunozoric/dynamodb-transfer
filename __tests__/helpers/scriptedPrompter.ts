import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";
import type { Prompter } from "~/features/Prompter/index.ts";

export interface ScriptedPrompterSpec {
  action?: () => Promise<Prompter.Action>;
  table?: (options: Prompter.TableOptions) => Promise<Config.ResolvedTable>;
  downloadFormat?: (options: Prompter.DownloadFormatOptions) => Promise<Paths.DownloadFormat>;
  segments?: () => Promise<number>;
  sourceFile?: () => Promise<string | null>;
  destPath?: (options: Prompter.DestPathOptions) => Promise<string | null>;
  confirmUpload?: (options: Prompter.ConfirmUploadOptions) => Promise<void>;
}

function scriptedMethod<TArgs extends unknown[], TResult>(
  method: string,
  impl: ((...args: TArgs) => Promise<TResult>) | undefined
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    if (!impl) {
      throw new Error(`ScriptedPrompter: ${method}() called but not scripted`);
    }
    return impl(...args);
  };
}

export function createScriptedPrompter(spec: ScriptedPrompterSpec): Prompter.Interface {
  return {
    action: scriptedMethod("action", spec.action),
    table: scriptedMethod("table", spec.table),
    downloadFormat: scriptedMethod("downloadFormat", spec.downloadFormat),
    segments: scriptedMethod("segments", spec.segments),
    sourceFile: scriptedMethod("sourceFile", spec.sourceFile),
    destPath: scriptedMethod("destPath", spec.destPath),
    confirmUpload: scriptedMethod("confirmUpload", spec.confirmUpload)
  };
}
