// Launcher: lists every prototype from the generated manifest.
// Each prototype runs as its own dev server, so open one with
// `pnpm dev <slug>` rather than linking to it here.
type Prototype = { slug: string; validates: string };

const list = document.getElementById("list") as HTMLUListElement;

async function load(): Promise<Prototype[]> {
  const res = await fetch("./prototypes.generated.json");
  if (!res.ok) return [];
  return (await res.json()) as Prototype[];
}

function render(prototypes: Prototype[]): void {
  if (prototypes.length === 0) {
    list.innerHTML = `<li class="empty">No prototypes yet. Scaffold one with <code>pnpm new-proto &lt;slug&gt;</code>.</li>`;
    return;
  }
  list.innerHTML = prototypes
    .map(
      (p) => `
      <li class="card">
        <div class="slug">${p.slug}</div>
        <div class="validates">${p.validates || "No <code>Validates:</code> line yet."}</div>
        <div class="validates">Open with <code>pnpm dev ${p.slug}</code></div>
      </li>`,
    )
    .join("");
}

load().then(render);
