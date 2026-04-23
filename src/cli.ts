import { bootstrap } from "./bootstrap.ts";
import { Cli } from "~/features/Cli/index.ts";
import { Logger } from "~/features/Logger/index.ts";

try {
    const container = await bootstrap();
    const cli = container.resolve(Cli);
    const logger = container.resolve(Logger);
    try {
        await cli.run();
    } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
            process.exit(0);
        }
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
} catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}
