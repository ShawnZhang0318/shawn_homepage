// Immutable V1.7.8 handwriting. Crop coordinates only; never re-type these labels.
// x, y, width, height, source baseline. Body descriptions are drawn separately.
const REGIONS = {
  work: [78, 12, 420, 160, 158],
  education: [78, 198, 416, 88, 270],
  school1: [78, 284, 970, 66, 326],
  msc: [154, 349, 643, 76, 393],
  school2: [78, 445, 970, 66, 494],
  bsc: [154, 506, 680, 64, 554],
  technology: [160, 570, 380, 72, 613],
  companies: [76, 656, 400, 99, 721],
  infiforce: [78, 757, 970, 75, 813],
  'agentic-intelligence-lab': [78, 827, 970, 80, 880],
  projects: [78, 932, 340, 83, 998],
  '05': [78, 1011, 85, 45, 1053],
  '06': [78, 1056, 85, 46, 1107],
  '07': [78, 1109, 85, 51, 1154],
  'name-infiforce': [164, 757, 540, 75, 813],
  'name-agentic-intelligence-lab': [164, 827, 540, 80, 880],
  'number-infiforce': [78, 757, 80, 75, 813],
  'number-agentic-intelligence-lab': [78, 827, 80, 80, 880],
  'date-infiforce': [721, 757, 327, 75, 813],
  'date-agentic-intelligence-lab': [721, 827, 327, 80, 880],
};

export class OriginalInk {
  constructor(image) {
    this.image = image;
    this.layers = new Map();
    for (const [name, [x, y, w, h, baseline]] of Object.entries(REGIONS)) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const min = Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
        // Retain original dark ink RGB and stroke contours; discard pale paper/rules.
        pixels.data[i + 3] = Math.round(Math.max(0, Math.min(1, (170 - min) / 25)) * 255);
      }
      ctx.putImageData(pixels, 0, 0);
      this.layers.set(name, { canvas, x, y, baseline });
    }
  }
  draw(ctx, name, baseline, { x = null, scale = 1 } = {}) {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`Missing original handwriting layer: ${name}`);
    ctx.drawImage(layer.canvas, x ?? layer.x, baseline + (layer.y - layer.baseline) * scale,
      layer.canvas.width * scale, layer.canvas.height * scale);
  }
}
