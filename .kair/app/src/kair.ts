import { fail } from "./core/errors";
import { main } from "./cli/main";

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
