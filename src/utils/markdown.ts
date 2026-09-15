function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/** Render lightweight markdown (##, ###, bullets, numbers, bold) to HTML */
export function mdToHtml(src: string): string {
  const rawLines = src.split("\n");
  let html = "";
  let list: string[] = [];
  let ol = false;

  const flush = () => {
    if (list.length) {
      const tag = ol ? "ol" : "ul";
      html += `<${tag}>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</${tag}>`;
      list = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      let nextNonEmpty = "";
      for (let j = i + 1; j < rawLines.length; j++) {
        if (rawLines[j].trim()) {
          nextNonEmpty = rawLines[j].trim();
          break;
        }
      }
      const continuesOl = ol && /^\d+[\.\)]\s+/.test(nextNonEmpty);
      const continuesUl = !ol && (nextNonEmpty.startsWith("• ") || nextNonEmpty.startsWith("- "));
      if (list.length && (continuesOl || continuesUl)) {
        continue;
      }
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith("### ")) {
      flush();
      html += `<h3>${inline(line.slice(4))}</h3>`;
    } else if (line.startsWith("> ")) {
      flush();
      html += `<blockquote style="border-left:3px solid var(--line-strong);padding-left:12px;color:var(--mute);margin:0.6em 0">${inline(line.slice(2))}</blockquote>`;
    } else if (/^\d+[\.\)]\s+/.test(line)) {
      if (!ol || !list.length) {
        flush();
        ol = true;
      }
      const cleanText = line.replace(/^(?:\d+[\.\)]\s*)+/, "").trim();
      list.push(cleanText);
    } else if (line.startsWith("• ") || line.startsWith("- ")) {
      if (ol || !list.length) {
        flush();
        ol = false;
      }
      const cleanText = line.replace(/^[•\-]\s*/, "").trim();
      list.push(cleanText);
    } else {
      flush();
      html += `<p>${inline(line)}</p>`;
    }
  }
  flush();
  return html;
}

/** Split a social post body into display blocks (paragraphs, bullets, hashtags) */
export interface PostBlock {
  type: "text" | "bullet" | "hashtag" | "empty";
  text: string;
}

export function parsePost(content: string): PostBlock[] {
  return content
    .split("\n")
    .map((raw) => raw.trim())
    .filter((l) => l.length > 0)
    .map((l): PostBlock => {
      if (l.startsWith("## ")) return { type: "empty", text: "" };
      if (l.startsWith("### ")) return { type: "empty", text: "" };
      if (l.startsWith("• ")) return { type: "bullet", text: l.slice(2).replace(/\*\*/g, "") };
      if (l.startsWith("#")) return { type: "hashtag", text: l };
      return { type: "text", text: l.replace(/\*\*/g, "") };
    })
    .filter((b) => b.type !== "empty");
}
