/* Deterministic mandala line-art. Same seed always draws the same figure,
   so a member can print the one they were coloring. */

function rng(seed){ let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => a + r() * (b - a);

function petalPath(r1, r2, w, curve){
  const top = 100 - r2, bot = 100 - r1;
  return `M100 ${bot.toFixed(1)} C${(100-w).toFixed(1)} ${(bot-curve).toFixed(1)} `
       + `${(100-w).toFixed(1)} ${(top+curve).toFixed(1)} 100 ${top.toFixed(1)} `
       + `C${(100+w).toFixed(1)} ${(top+curve).toFixed(1)} ${(100+w).toFixed(1)} `
       + `${(bot-curve).toFixed(1)} 100 ${bot.toFixed(1)} Z`;
}

export function mandala(seed, { stroke = '#16241C', width = 1.1 } = {}){
  const r = rng(seed);
  const defs = [], layers = [];
  const rings = 4 + Math.floor(r() * 3);
  let rad = 16;

  for (let k = 0; k < rings; k++){
    const n  = pick(r, [8, 12, 16, 6, 10]);
    const r1 = rad, r2 = rad + between(r, 13, 22);
    const style = pick(r, ['petal','petal','dots','arcs']);

    if (style === 'petal'){
      const id = `p${seed}_${k}`;
      defs.push(`<path id="${id}" d="${petalPath(r1, r2, between(r,4,11), between(r,4,14))}"/>`);
      layers.push('<g>' + Array.from({length:n}, (_,i) =>
        `<use href="#${id}" transform="rotate(${(360*i/n).toFixed(1)} 100 100)"/>`).join('') + '</g>');
    } else if (style === 'dots'){
      const rr = (r1 + r2) / 2, dot = between(r, 2.2, 4.5);
      layers.push('<g>' + Array.from({length:n}, (_,i) => {
        const a = 2*Math.PI*i/n - Math.PI/2;
        return `<circle cx="${(100+rr*Math.cos(a)).toFixed(1)}" cy="${(100+rr*Math.sin(a)).toFixed(1)}" r="${dot.toFixed(1)}"/>`;
      }).join('') + '</g>');
    } else {
      const id = `a${seed}_${k}`, rr = (r1 + r2) / 2, span = 360 / n;
      const a0 = -Math.PI/2 - span*Math.PI/360, a1 = -Math.PI/2 + span*Math.PI/360;
      defs.push(`<path id="${id}" d="M${(100+rr*Math.cos(a0)).toFixed(1)} ${(100+rr*Math.sin(a0)).toFixed(1)} `
        + `A${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${(100+rr*Math.cos(a1)).toFixed(1)} ${(100+rr*Math.sin(a1)).toFixed(1)}"/>`);
      layers.push('<g>' + Array.from({length:n}, (_,i) =>
        `<use href="#${id}" transform="rotate(${(360*i/n).toFixed(1)} 100 100)"/>`).join('') + '</g>');
    }
    layers.push(`<circle cx="100" cy="100" r="${r2.toFixed(1)}"/>`);
    rad = r2;
    if (rad > 88) break;
  }
  layers.push('<circle cx="100" cy="100" r="7"/>');
  layers.push(`<circle cx="100" cy="100" r="${Math.min(rad + 4, 96).toFixed(1)}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"
    stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"
    style="width:100%;height:auto;display:block">
    <defs>${defs.join('')}</defs>${layers.join('')}</svg>`;
}
