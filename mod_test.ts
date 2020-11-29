import { assertEquals } from "./deps/asserts.ts";
import { exec, OutputMode } from "./deps/exec.ts";
import { command } from "./mod.ts";

import * as Errors from "./errors.ts";

Deno.test("typepiler-tool-kotlin", async () => {
  const errors = await testpiler("sets");
  assertEquals(errors, []);

  await gradle();
});

async function testpiler(name: string): Promise<Errors.Errors> {
  return await command(
    [{
      src: `./test/src/main/kotlin/${name}/Types.llt`,
      package: `${name}.Types`,
    }],
    {
      directory: "./test/src/main/kotlin",
      force: true,
      verbose: true,
    },
  );
}

async function gradle() {
  const result = await exec(
    '/bin/bash -c "cd test ; ./gradlew test"',
    { output: OutputMode.Capture },
  );

  if (result.status.code !== 0) {
    console.log(result);
  }

  assertEquals(result.status.code, 0);
}
