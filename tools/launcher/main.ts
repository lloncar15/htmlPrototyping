// Launcher: lists every prototype from the generated manifest. `pnpm dev`
// serves the whole repo, so each card links straight to the prototype at
// /prototypes/<slug>/ with its own HMR.
type Prototype = {
  slug: string;
  validates: string;
  renderer: string;
  testing: string;
  mode: string;
  dimension: string;
};

const list = document.getElementById("list") as HTMLUListElement;

async function load(): Promise<Prototype[]> {
  const res = await fetch("/tools/launcher/prototypes.generated.json");
  if (!res.ok) return [];
  return (await res.json()) as Prototype[];
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function badges(p: Prototype): string {
  return [p.dimension, p.mode]
    .filter(Boolean)
    .map((label) => `<span class="badge">${escapeHtml(label)}</span>`)
    .join("");
}

function render(prototypes: Prototype[]): void {
  if (prototypes.length === 0) {
    list.innerHTML = `<li class="empty">No prototypes yet. Scaffold one with <code>pnpm new-proto &lt;slug&gt;</code>.</li>`;
    return;
  }
  list.innerHTML = prototypes
    .map(
      (p) => `
      <li>
        <a class="card" href="/prototypes/${encodeURIComponent(p.slug)}/">
          <div class="slug">${escapeHtml(p.slug)}${badges(p)}</div>
          <div class="validates">${p.validates ? escapeHtml(p.validates) : "No <code>Validates:</code> line yet."}</div>
          <div class="validates">or <code>pnpm dev ${escapeHtml(p.slug)}</code></div>
        </a>
      </li>`,
    )
    .join("");
}

load().then(render);
