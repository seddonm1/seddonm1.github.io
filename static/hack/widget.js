import { CodeJar } from "https://cdn.jsdelivr.net/npm/codejar@4.3.0/dist/codejar.min.js";
import { withLineNumbers } from "https://cdn.jsdelivr.net/npm/codejar-linenumbers@1.0.1/es/index.min.js";
import init, { assemble } from "./pkg/hack.js";

const DEST_PATTERN = /\b(AMD|AD|AM|MD|A|D|M)(\s*=)/g;
const JUMP_PATTERN = /(;[\t ]*)(JGT|JEQ|JGE|JLT|JNE|JLE|JMP)\b/g;
const A_PATTERN = /(^|[\t ])(@)([A-Za-z_.$:][A-Za-z0-9_.$:]*|\d+)(?=$|[\t ])/g;
const NUMBER_PATTERN = /(^|[^A-Za-z0-9_.$:])(\d+)(?=$|[^A-Za-z0-9_.$:])/g;
const LABEL_PATTERN = /^([\t ]*)\(([A-Za-z_.$:][A-Za-z0-9_.$:]*)\)([\t ]*)$/;

function formatError(err) {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return String(err);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlightHackLine(line) {
  const commentIndex = line.indexOf("//");
  const codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : "";

  let highlighted = escapeHtml(codePart);

  highlighted = highlighted.replace(
    LABEL_PATTERN,
    '$1<span class="hack-token-label">($2)</span>$3',
  );
  highlighted = highlighted.replace(
    A_PATTERN,
    '$1<span class="hack-token-a">$2$3</span>',
  );
  highlighted = highlighted.replace(
    DEST_PATTERN,
    '<span class="hack-token-dest">$1</span>$2',
  );
  highlighted = highlighted.replace(
    JUMP_PATTERN,
    '$1<span class="hack-token-jump">$2</span>',
  );
  highlighted = highlighted.replace(
    NUMBER_PATTERN,
    '$1<span class="hack-token-number">$2</span>',
  );

  if (commentPart.length > 0) {
    highlighted += `<span class="hack-token-comment">${escapeHtml(commentPart)}</span>`;
  }

  return highlighted;
}

function highlightEditor(editor) {
  const code = editor.textContent ?? "";
  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  editor.innerHTML = lines.map((line) => highlightHackLine(line)).join("\n");
}

function evaluateRunner(runnerEl) {
  const sourceEl = runnerEl.querySelector("[data-hack-source]");
  const resultEl = runnerEl.querySelector("[data-hack-result]");
  const resultPanelEl = runnerEl.querySelector(".hack-runner-result-panel");

  if (!sourceEl || !resultEl || !resultPanelEl) {
    return;
  }

  try {
    resultEl.textContent = assemble(sourceEl.textContent ?? "");
    resultPanelEl.dataset.hackKind = "ok";
  } catch (err) {
    resultEl.textContent = formatError(err);
    resultPanelEl.dataset.hackKind = "error";
  }
}

function wireRunner(runnerEl) {
  const sourceEl = runnerEl.querySelector("[data-hack-source]");
  if (!sourceEl) {
    return;
  }

  const jar = CodeJar(
    sourceEl,
    withLineNumbers(highlightEditor, {
      width: "30px",
      backgroundColor: "#f3f5f8",
      color: "#5d6776",
    }),
    {
      tab: "\t",
      addClosing: false,
    },
  );
  jar.updateCode(sourceEl.textContent ?? "", false);
  jar.onUpdate(() => evaluateRunner(runnerEl));
  evaluateRunner(runnerEl);
}

async function boot() {
  await init();

  document
    .querySelectorAll("[data-hack-runner]")
    .forEach((runnerEl) => wireRunner(runnerEl));
}

boot().catch((err) => {
  document.querySelectorAll("[data-hack-runner]").forEach((runnerEl) => {
    const resultEl = runnerEl.querySelector("[data-hack-result]");
    const resultPanelEl = runnerEl.querySelector(".hack-runner-result-panel");
    if (resultEl) {
      resultEl.textContent = formatError(err);
    }
    if (resultPanelEl) {
      resultPanelEl.dataset.hackKind = "error";
    }
  });
});
