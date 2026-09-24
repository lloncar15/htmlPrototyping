// @proto/ui — the designer layer: tuning panel, version stamp, note box,
// theme loader. This is the one package that may touch the DOM; it is
// renderer-side by design and never contains game rules.
export * from "./theme";
export * from "./tuning";
export * from "./stamp";
export * from "./notes";
export * from "./download";
export * from "./backlink";
