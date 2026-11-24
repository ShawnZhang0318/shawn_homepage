export const studio = {
  background: '#121110', ink: '#f4ede2', muted: '#9c9387', gold: '#e5a95c',
  line: 'rgba(244,237,226,.12)', card: 'rgba(244,237,226,.04)',
};

export async function loadScreenFonts() {
  await Promise.all([
    document.fonts.load('600 20px "Inter"'),
    document.fonts.load('400 12px "JetBrains Mono"'),
  ]);
}

export function paintStudio(pen, width, height) {
  pen.fillStyle = studio.background;
  pen.fillRect(0, 0, width, height);
  const vignette = pen.createRadialGradient(width * .45, height * .3, 0, width * .5, height * .5, width * .7);
  vignette.addColorStop(0, 'rgba(80,61,40,.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,.16)');
  pen.fillStyle = vignette;
  pen.fillRect(0, 0, width, height);
}

export function drawText(pen, text, x, y, size, color = studio.ink, weight = 400, mono = false) {
  pen.fillStyle = color;
  pen.font = `${weight} ${size}px "${mono ? 'JetBrains Mono' : 'Inter'}", "Microsoft YaHei", sans-serif`;
  pen.fillText(text, x, y);
}

export function textLines(pen, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/(\s+)/)) {
    if (line && pen.measureText(line + word).width > width) {
      lines.push(line.trim()); line = word.trimStart();
    } else line += word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function drawWrapped(pen, text, x, y, width, size, lineHeight, color, weight = 400, maxLines = Infinity) {
  drawText(pen, '', x, y, size, color, weight);
  const lines = textLines(pen, text, width).slice(0, maxLines);
  lines.forEach((line, index) => pen.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

export function line(pen, x1, y1, x2, y2, color = studio.line) {
  pen.strokeStyle = color; pen.lineWidth = 1; pen.beginPath();
  pen.moveTo(x1, y1); pen.lineTo(x2, y2); pen.stroke();
}

export const githubPath = 'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.7.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.2-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.8 18.3 5 18.3 5c.7 1.7.3 3 .2 3.3a4.7 4.7 0 0 1 1.2 3.2c0 4.6-2.8 5.7-5.5 6 .5.4.8 1.1.8 2.2v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z';
export const linkedinPath = 'M5.4 7.7H1.9V22h3.5V7.7ZM3.7 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2ZM22 13.7c0-4.3-2.3-6.3-5.3-6.3-2.5 0-3.5 1.4-4.1 2.4V7.7H9.1V22h3.5v-8c0-2.1 1.1-3.2 2.8-3.2 1.7 0 3.1.8 3.1 3.2v8H22v-8.3Z';
export const profileIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${name === 'GitHub' ? githubPath : linkedinPath}"/></svg>`;
