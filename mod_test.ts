import * as Assert from "./deps/asserts.ts";
import { exec, OutputMode } from "./deps/exec.ts";

import { greeter } from "./mod.ts";

Deno.test("hello", () => {
  Assert.assertEquals(greeter("Graeme"), "Hello Graeme");
});

/*
Deno.test("scanpiler-tool-kotlin", async () => {
  await parspiler("alternative");
  await parspiler("simple");
  await parspiler("parspiler");

  await gradle();
});
*/

// async function parspiler(name: string) {
//   await command(
//     `./test/src/main/kotlin/${name}/parser.llgd`,
//     {
//       directory: "./test/src/main/kotlin",
//       scannerPackage: `${name}.scanner`,
//       parserPackage: `${name}`,
//       force: true,
//       verbose: true,
//     },
//   );
// }

async function gradle() {
  const result = await exec(
    '/bin/bash -c "cd test ; ./gradlew test"',
    { output: OutputMode.Capture },
  );

  if (result.status.code !== 0) {
    console.log(result);
  }

  Assert.assertEquals(result.status.code, 0);
}
