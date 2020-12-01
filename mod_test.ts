import { assertEquals } from "./deps/asserts.ts";
import { exec, OutputMode } from "./deps/exec.ts";
import { command } from "./mod.ts";

Deno.test("typepiler-tool-kotlin", async () => {
  await testpiler([
    ["sets", "Types"],
    ["alias", "Sample"],
    ["union", "Sample"],
    ["composite", "Simple"],
    ["composite", "Record"],
  ]);

  await gradle();
});

async function testpiler(srcs: Array<[string, string]>): Promise<void> {
  const errors = await command(
    srcs.map(([dir, name]) => ({
      src: `./test/src/main/kotlin/${dir}/${name}.llt`,
      package: `${dir}.${name}`,
    })),
    {
      directory: "./test/src/main/kotlin",
      force: true,
      verbose: true,
    },
  );

  assertEquals(errors, []);
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
