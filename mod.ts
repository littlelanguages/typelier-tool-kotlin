import { right } from "https://raw.githubusercontent.com/littlelanguages/deno-lib-data-either/0.1.2/mod.ts";
import * as Path from "./deps/path.ts";
import * as PP from "./deps/prettyprint.ts";
import * as Typepiler from "./deps/typepiler.ts";

import * as Errors from "./errors.ts";

type CommandSrc = {
  src: string;
  package: string;
};

type CommandOptions = {
  directory: string | undefined;
  force: boolean;
  verbose: boolean;
};

export const command = (
  srcs: Array<CommandSrc>,
  options: CommandOptions,
): Promise<Errors.Errors> => {
  const buildResult = (mustBuild(srcs, options))
    ? Typepiler.translateFiles(srcs.map((src) => src.src)).then(
      (translateResult) =>
        translateResult.either(
          (e) => Promise.resolve(e),
          (types) => writeTypess(types, srcs, options),
        ),
    )
    : Promise.resolve([]);

  return buildResult.then((r) => copyLibrary(options).then((_) => r));
};

const writeTypess = (
  typess: Array<Typepiler.Types>,
  srcs: Array<CommandSrc>,
  options: CommandOptions,
): Promise<Errors.Errors> =>
  Promise.all(typess.map((types) => writeTypes(types, srcs, options))).then((
    rs,
  ) => rs.flatMap((i) => i));

const writeTypes = async (
  types: Typepiler.Types,
  srcs: Array<CommandSrc>,
  options: CommandOptions,
): Promise<Errors.Errors> => {
  const src = findSrc(
    types.canonicalFileName,
    srcs,
  );

  if (src === undefined) {
    return Promise.resolve([
      { tag: "PackageNotSetError", name: types.canonicalFileName },
    ]);
  } else {
    const fileName = targetFileName(src, options);
    const doc = renderDeclarations(src.package, types.declarations, srcs);

    const writer = await Deno.create(fileName);
    await PP.render(doc, writer);
    await writer.close();

    return Promise.resolve([]);
  }
};

const renderDeclarations = (
  className: string,
  declarations: Typepiler.Declarations,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  PP.vcat([
    PP.hsep(["package", packageName(className)]),
    "",
    PP.vcat(declarations.map((d) => PP.vcat([renderDeclaration(d, srcs), ""]))),
  ]);

const renderDeclaration = (
  declaration: Typepiler.Declaration,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  (declaration.tag === "SetDeclaration")
    ? renderSetDeclaration(declaration)
    : (declaration.tag === "SimpleComposite")
    ? renderSimpleDeclaration(declaration, srcs)
    : (declaration.tag === "RecordComposite")
    ? renderRecordDeclaration(declaration, srcs)
    : PP.empty;

const renderSetDeclaration = (declaration: Typepiler.SetDeclaration): PP.Doc =>
  PP.vcat([
    PP.hsep(["enum class", declaration.name, "{"]),
    PP.nest(2, PP.hsep(declaration.elements, ", ")),
    "}",
  ]);

const renderSimpleDeclaration = (
  declaration: Typepiler.SimpleComposite,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  PP.hcat(
    [
      "data class ",
      declaration.name,
      "(val state: ",
      renderType(declaration.type, srcs),
      ")",
    ],
  );

const renderRecordDeclaration = (
  declaration: Typepiler.RecordComposite,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  PP.vcat([
    PP.hcat(
      [
        "data class ",
        declaration.name,
        "(",
      ],
    ),
    PP.hcat([
      PP.nest(
        2,
        PP.vcat(
          PP.punctuate(
            ",",
            declaration.fields.map(([n, y]) =>
              PP.hcat(["val ", n, ": ", renderType(y, srcs)])
            ),
          ),
        ),
      ),
      ")",
    ]),
  ]);

const renderType = (
  type: Typepiler.Type,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  (type.tag === "Tuple")
    ? PP.hcat(
      [
        "io.littlelanguages.data.Tuple",
        type.value.length.toString(),
        "<",
        PP.hsep(type.value.map((t) => renderType(t, srcs)), ", "),
        ">",
      ],
    )
    : (type.declaration.tag === "InternalDeclaration")
    ? PP.hcat(
      [
        internalTypeNames.get(type.declaration.name)!,
        type.declaration.arity === 0 ? PP.blank : PP.hcat([
          "<",
          PP.hsep(type.parameters.map((t) => renderType(t, srcs)), ", "),
          ">",
        ]),
      ],
    )
    : PP.hcat(
      [
        packageName(findSrc(type.declaration.src, srcs)!.package),
        ".",
        type.declaration.name,
      ],
    );

const internalTypeNames = new Map([
  ["Bool", "Boolean"],
  ["U8", "UByte"],
  ["S8", "Byte"],
  ["U16", "UShort"],
  ["S16", "Short"],
  ["U32", "UInt"],
  ["S32", "Int"],
  ["U64", "ULong"],
  ["S64", "Long"],
  ["F32", "Float"],
  ["F64", "Double"],
  ["Char", "Char"],
  ["String", "String"],
  ["Seq", "List"],
  ["Set", "Set"],
  ["Map", "Map"],
]);

const packageName = (className: string): string => {
  const lastIndex = className.lastIndexOf(".");

  return lastIndex === -1 ? "" : className.substr(0, lastIndex);
};

const mustBuild = (
  srcs: Array<CommandSrc>,
  options: CommandOptions,
): boolean =>
  srcs.map((src) =>
    src.src.startsWith("http")
      ? fileDateTime(targetFileName(src, options)) === 0
      : fileDateTime(src.src) > fileDateTime(targetFileName(src, options))
  ).reduce((a, b) => a || b, options.force);

const findSrc = (
  canonicalFileName: string,
  srcs: Array<CommandSrc>,
): CommandSrc | undefined => {
  const suffix = (s: string): string =>
    s.startsWith("./")
      ? suffix(s.substr(2))
      : s.startsWith("../")
      ? suffix(s.substr(3))
      : s;

  return srcs.find((s) => canonicalFileName.endsWith(suffix(s.src)));
};

const targetFileName = (src: CommandSrc, options: CommandOptions): string => {
  const directory = options.directory || "./";

  return Path.normalize(`${directory}/${src.package.replace(".", "/")}.kt`);
};

const fileDateTime = (name: string): number => {
  try {
    return Deno.lstatSync(name)?.mtime?.getTime() || 0;
  } catch (_) {
    return 0;
  }
};

export const copyLibrary = async (
  options: CommandOptions,
): Promise<void> => {
  const copyFile = async (
    srcName: string,
    targetName: string,
  ): Promise<void> => {
    const outputFileName = `${options.directory || "./"}/${targetName}`;

    if (options.force || fileDateTime(outputFileName) === 0) {
      const srcFileName = `${Path.dirname(import.meta.url)}/${srcName}`;

      console.log(`Copy ${srcName}`);

      return Deno.mkdir(Path.dirname(outputFileName), { recursive: true })
        .then((_) =>
          (srcFileName.startsWith("file://"))
            ? Deno.copyFile(
              srcFileName.substr(7),
              outputFileName,
            )
            : srcFileName.startsWith("http://") ||
                srcFileName.startsWith("https://")
            ? fetch(srcFileName).then((response) => response.text()).then((
              t: string,
            ) => Deno.writeFile(outputFileName, new TextEncoder().encode(t)))
            : Deno.copyFile(
              srcFileName,
              outputFileName,
            )
        );
    } else {
      return Promise.resolve();
    }
  };

  await copyFile(
    "lib/kotlin/Tuple.kt",
    "io/littlelanguages/data/Tuple.kt",
  );

  return await copyFile(
    "lib/kotlin/Union.kt",
    "io/littlelanguages/data/Union.kt",
  );
};
