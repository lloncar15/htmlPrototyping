// Renderer + input only. Game rules will live in src/sim.ts (Stage 2).
import theme from "../config/theme.json";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

function drawPlaceholder(): void {
  const { width, height } = canvas;
  ctx.fillStyle = theme.panel;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(width / 2 - 40, height / 2 - 60, 80, 80);

  ctx.fillStyle = theme.text;
  ctx.font = theme.font;
  ctx.textAlign = "center";
  ctx.fillText("_template boots", width / 2, height / 2 + 50);
}

drawPlaceholder();
