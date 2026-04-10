import { Style, StyledChar } from './rich';

const SGR_RE = /^\u001b\[([\d;]*)m/;
const OSC_RE = /^\u001b\](\d+);([^\u0007\u001b]*)(?:\u0007|\u001b\\)/;
const CSI_RE = /^\u001b\[[\d;?]*[A-Za-z]/;
const OTHER_ESC_RE = /^\u001b[()#^_=>NO<]/;

export function parseAnsi(raw: string): StyledChar[] {
  const out: StyledChar[] = [];
  let style: Style = {};
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '\u001b') {
      const rest = raw.slice(i);

      const osc = rest.match(OSC_RE);
      if (osc) {
        const [, code, payload] = osc;
        if (code === '8') {
          const semi = payload.indexOf(';');
          const url = semi >= 0 ? payload.slice(semi + 1) : '';
          style = url ? { ...style, href: url } : { ...style, href: undefined };
        }
        i += osc[0].length;
        continue;
      }

      const sgr = rest.match(SGR_RE);
      if (sgr) {
        style = applySgr(style, sgr[1]);
        i += sgr[0].length;
        continue;
      }

      const csi = rest.match(CSI_RE);
      if (csi) {
        i += csi[0].length;
        continue;
      }

      const other = rest.match(OTHER_ESC_RE);
      if (other) {
        i += other[0].length;
        continue;
      }

      i++;
      continue;
    }
    out.push({ ch: raw[i], style: cloneStyle(style) });
    i++;
  }
  return out;
}

function cloneStyle(s: Style): Style {
  const out: Style = {};
  if (s.bold) out.bold = true;
  if (s.italic) out.italic = true;
  if (s.underline) out.underline = true;
  if (s.strike) out.strike = true;
  if (s.code) out.code = true;
  if (s.href) out.href = s.href;
  return out;
}

function applySgr(style: Style, paramStr: string): Style {
  const codes = paramStr === '' ? [0] : paramStr.split(';').map((n) => parseInt(n, 10) || 0);
  let s: Style = { ...style };
  let i = 0;
  while (i < codes.length) {
    const c = codes[i];
    switch (c) {
      case 0:
        s = { href: style.href };
        break;
      case 1:
        s.bold = true;
        break;
      case 22:
        s.bold = false;
        break;
      case 3:
        s.italic = true;
        break;
      case 23:
        s.italic = false;
        break;
      case 4:
        s.underline = true;
        break;
      case 24:
        s.underline = false;
        break;
      case 9:
        s.strike = true;
        break;
      case 29:
        s.strike = false;
        break;
      case 38:
      case 48:
        if (codes[i + 1] === 5) {
          i += 2;
        } else if (codes[i + 1] === 2) {
          i += 4;
        }
        break;
    }
    i++;
  }
  return s;
}
