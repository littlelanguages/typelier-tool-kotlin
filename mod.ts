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
): Promise<Errors.Errors> => {
  const unionDeps = calculateUnionDeps(typess);

  return Promise.all(
    typess.map((types) => writeTypes(types, unionDeps, srcs, options)),
  ).then((rs) => rs.flatMap((i) => i));
};

type UnionElementType =
  | Typepiler.UnionDeclaration
  | Typepiler.SimpleComposite
  | Typepiler.RecordComposite;

const calculateUnionDeps = (typess: Array<Typepiler.Types>): UnionDeps => {
  const result: UnionDeps = [];

  const addDep = (
    element: UnionElementType,
    union: Typepiler.UnionDeclaration,
  ) => {
    const unionDep = findUnionDep(element, result);

    if (unionDep === undefined) {
      result.push([element, [union]]);
    } else {
      unionDep.push(union);
    }
  };

  typess.forEach((types) =>
    types.declarations.forEach((declaration) => {
      if (declaration.tag === "UnionDeclaration") {
        declaration.elements.forEach((element) => addDep(element, declaration));
      }
    })
  );
  return result;
};

type UnionDeps = Array<[UnionElementType, Array<Typepiler.UnionDeclaration>]>;

const findUnionDep = (
  declaration: UnionElementType,
  unionDeps: UnionDeps,
): Array<Typepiler.UnionDeclaration> | undefined => {
  const result = unionDeps.find((dep) => dep[0].name === declaration.name);

  return result === undefined ? undefined : result[1];
};

const writeTypes = async (
  types: Typepiler.Types,
  unionDeps: UnionDeps,
  srcs: Array<CommandSrc>,
  options: CommandOptions,
): Promise<Errors.Errors> => {
  const src = findSrc(types.canonicalFileName, srcs);

  if (src === undefined) {
    return Promise.resolve([
      { tag: "PackageNotSetError", name: types.canonicalFileName },
    ]);
  } else {
    const fileName = targetFileName(src, options);
    const doc = renderDeclarations(
      src.package,
      types.declarations,
      unionDeps,
      srcs,
    );

    const writer = await Deno.create(fileName);
    await PP.render(doc, writer);
    await writer.close();

    return Promise.resolve([]);
  }
};

const renderDeclarations = (
  className: string,
  declarations: Typepiler.Declarations,
  unionDeps: UnionDeps,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  PP.vcat([
    PP.hsep(["package", packageName(className)]),
    "",
    "import io.littlelanguages.data.Yamlable",
    "",
    PP.vcat(
      declarations.map((d) =>
        PP.vcat([renderDeclaration(d, unionDeps, srcs), ""])
      ),
    ),
  ]);

const renderDeclaration = (
  declaration: Typepiler.Declaration,
  unionDeps: UnionDeps,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  (declaration.tag === "SetDeclaration")
    ? renderSetDeclaration(declaration)
    : (declaration.tag === "SimpleComposite")
    ? renderSimpleDeclaration(declaration, unionDeps, srcs)
    : (declaration.tag === "RecordComposite")
    ? renderRecordDeclaration(declaration, unionDeps, srcs)
    : (declaration.tag === "AliasDeclaration")
    ? renderAliasDeclaration(declaration, srcs)
    : (declaration.tag === "UnionDeclaration")
    ? renderUnionDeclaration(declaration)
    : PP.blank;

const renderSetDeclaration = (declaration: Typepiler.SetDeclaration): PP.Doc =>
  PP.vcat([
    PP.hcat(["enum class ", declaration.name, " : Yamlable {"]),
    PP.nest(
      2,
      PP.vcat(
        [
          PP.hcat([PP.hsep(declaration.elements, ", "), ";"]),
          "",
          "override fun yaml(): Any =",
          PP.nest(
            2,
            PP.vcat([
              "when (this) {",
              PP.nest(
                2,
                PP.vcat(
                  declaration.elements.map((n) =>
                    PP.hcat([n, ' -> "', n, '"'])
                  ),
                ),
              ),
              "}",
            ]),
          ),
        ],
      ),
    ),
    "}",
  ]);

const renderSimpleDeclaration = (
  declaration: Typepiler.SimpleComposite,
  unionDeps: UnionDeps,
  srcs: Array<CommandSrc>,
): PP.Doc => {
  const deps = findUnionDep(declaration, unionDeps);

  return PP.vcat([
    PP.hcat(
      [
        "data class ",
        declaration.name,
        "(",
      ],
    ),
    PP.nest(
      4,
      PP.hcat([
        "val state: ",
        renderType(declaration, declaration.type, srcs),
        ") : Yamlable",
        deps === undefined ? PP.blank : PP.hcat([
          ", ",
          PP.hsep(
            deps.map((dep) =>
              declarationClassReference(declaration, dep, srcs)
            ),
            ", ",
          ),
        ]),
        " {",
      ]),
    ),
    PP.nest(
      2,
      PP.vcat([
        "override fun yaml(): Any =",
        PP.nest(
          2,
          PP.hcat(
            [
              'singletonMap("',
              declaration.name,
              '", ',
              renderTypeYaml("state", declaration.type),
              ")",
            ],
          ),
        ),
      ]),
    ),
    "}",
  ]);
};

const renderRecordDeclaration = (
  declaration: Typepiler.RecordComposite,
  unionDeps: UnionDeps,
  srcs: Array<CommandSrc>,
): PP.Doc => {
  const deps = findUnionDep(declaration, unionDeps);

  return PP.vcat([
    PP.hcat(["data class ", declaration.name, "("]),
    PP.hcat([
      PP.nest(
        4,
        PP.vcat(
          PP.punctuate(
            ",",
            declaration.fields.map(([n, y]) =>
              PP.hcat(["val ", n, ": ", renderType(declaration, y, srcs)])
            ),
          ),
        ),
      ),
      ") : Yamlable",
      deps === undefined ? PP.blank : PP.hcat([
        ", ",
        PP.hsep(
          deps.map((dep) => declarationClassReference(declaration, dep, srcs)),
          ", ",
        ),
      ]),
      " {",
    ]),
    PP.nest(
      2,
      PP.vcat([
        "override fun yaml(): Any =",
        PP.nest(
          2,
          PP.vcat([
            PP.hcat(['singletonMap("', declaration.name, '", mapOf(']),
            PP.nest(
              2,
              PP.hcat([
                PP.vcat(
                  PP.punctuate(
                    ",",
                    declaration.fields.map(([n, t]) =>
                      PP.hcat([
                        'Pair("',
                        n,
                        '", ',
                        renderTypeYaml(n, t),
                        ")",
                      ])
                    ),
                  ),
                ),
                "))",
              ]),
            ),
          ]),
        ),
      ]),
    ),
    "}",
  ]);
};

const renderAliasDeclaration = (
  declaration: Typepiler.AliasDeclaration,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  PP.hcat(
    [
      "typealias ",
      declaration.name,
      " = ",
      renderType(declaration, declaration.type, srcs),
    ],
  );

const renderUnionDeclaration = (
  declaration: Typepiler.UnionDeclaration,
): PP.Doc => PP.hcat(["interface ", declaration.name, " : Yamlable"]);

const renderType = (
  ctx:
    | Typepiler.AliasDeclaration
    | Typepiler.SimpleComposite
    | Typepiler.RecordComposite,
  type: Typepiler.Type,
  srcs: Array<CommandSrc>,
): PP.Doc =>
  (type.tag === "Tuple")
    ? PP.hcat(
      [
        "io.littlelanguages.data.Tuple",
        type.value.length.toString(),
        "<",
        PP.hsep(type.value.map((t) => renderType(ctx, t, srcs)), ", "),
        ">",
      ],
    )
    : (type.declaration.tag === "InternalDeclaration")
    ? PP.hcat(
      [
        internalTypeNames.get(type.declaration.name)!,
        type.declaration.arity === 0 ? PP.blank : PP.hcat([
          "<",
          PP.hsep(type.parameters.map((t) => renderType(ctx, t, srcs)), ", "),
          ">",
        ]),
      ],
    )
    : ctx.src === type.declaration.src
    ? PP.text(type.declaration.name)
    : PP.hcat(
      [
        packageName(findSrc(type.declaration.src, srcs)!.package),
        ".",
        type.declaration.name,
      ],
    );

const renderTypeYaml = (name: string, type: Typepiler.Type): PP.Doc =>
  (type.tag === "Tuple")
    ? PP.vcat([
      "mapOf(",
      PP.nest(
        2,
        PP.hcat([
          PP.vcat(
            PP.punctuate(
              ",",
              type.value.map((v, idx) =>
                PP.hcat([
                  'Pair("',
                  String.fromCharCode(idx + 97),
                  '", ',
                  renderTypeYaml(`${name}.${String.fromCharCode(idx + 97)}`, v),
                  ")",
                ])
              ),
            ),
          ),
          ")",
        ]),
      ),
    ])
    : (type.declaration.tag === "InternalDeclaration")
    ? (type.declaration.name === "Seq"
      ? PP.hcat(
        [name, ".map { ", renderTypeYaml("it", type.parameters[0]), " }"],
      )
      : type.declaration.name === "Set"
      ? PP.hcat(
        [name, ".map { ", renderTypeYaml("it", type.parameters[0]), " }"],
      )
      : type.declaration.name === "Map"
      ? PP.hcat(
        [
          name,
          ".map { Pair(",
          renderTypeYaml("it.key", type.parameters[0]),
          ", ",
          renderTypeYaml("it.value", type.parameters[1]),
          ")}",
        ],
      )
      : PP.text(name))
    : PP.hcat([name, ".yaml()"]);

const declarationClassReference = (
  ctx:
    | Typepiler.AliasDeclaration
    | Typepiler.SimpleComposite
    | Typepiler.RecordComposite,
  declaration: Typepiler.Declaration,
  srcs: Array<CommandSrc>,
): string =>
  (declaration.tag !== "InternalDeclaration" && ctx.src === declaration.src)
    ? declaration.name
    : (declaration.tag === "InternalDeclaration")
    ? internalTypeNames.get(declaration.name)!
    : packageName(findSrc(declaration.src, srcs)!.package) +
      "." +
      declaration.name;

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
    "lib/kotlin/Yamlable.kt",
    "io/littlelanguages/data/Yamlable.kt",
  );

  await copyFile(
    "lib/kotlin/Tuple.kt",
    "io/littlelanguages/data/Tuple.kt",
  );

  return await copyFile(
    "lib/kotlin/Union.kt",
    "io/littlelanguages/data/Union.kt",
  );
};
