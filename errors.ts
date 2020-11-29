import * as E from "./deps/typepiler.ts";

export type Errors = Array<ErrorItem>;

export type ErrorItem = E.ErrorItem | PackageNotSetError;

export type PackageNotSetError = {
  tag: "PackageNotSetError";
  name: string;
};
