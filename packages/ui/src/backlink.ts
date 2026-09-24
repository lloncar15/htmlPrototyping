// "← Prototypes" corner link. `pnpm dev` serves the launcher at / and each
// prototype at /prototypes/<slug>/, so the link is only useful there: under
// `pnpm dev <slug>` the prototype is the whole server and / is itself.

export type BackLink = {
  /** null when the page is not served under /prototypes/. */
  element: HTMLAnchorElement | null;
  dispose(): void;
};

export type BackLinkOptions = {
  /** Defaults to the current path; pass one to test the decision. */
  pathname?: string;
  label?: string;
  href?: string;
  container?: HTMLElement;
};

/** True only for pages served under /prototypes/, where a launcher exists. */
export function shouldShowBackLink(pathname: string): boolean {
  return pathname.startsWith("/prototypes/");
}

export function createBackLink(options: BackLinkOptions = {}): BackLink {
  const pathname = options.pathname ?? location.pathname;
  if (!shouldShowBackLink(pathname)) {
    return { element: null, dispose: () => {} };
  }

  const element = document.createElement("a");
  element.dataset.backlink = "";
  element.href = options.href ?? "/";
  element.textContent = options.label ?? "← Prototypes";
  element.style.cssText = [
    "position:fixed",
    "left:8px",
    "top:8px",
    "z-index:10",
    "padding:3px 9px",
    "border-radius:4px",
    "background:rgba(0,0,0,0.55)",
    "color:#e6e8eb",
    "font:11px/1.4 ui-monospace, monospace",
    "text-decoration:none",
    "user-select:none",
  ].join(";");

  (options.container ?? document.body).appendChild(element);
  return { element, dispose: () => element.remove() };
}
