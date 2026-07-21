import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RPC session startup preloads extension-registered providers before restoring models", async () => {
  const source = await readFile(new URL("./rpc-manager.ts", import.meta.url), "utf8");
  const startupSource = source.slice(source.indexOf("export async function startRpcSession"));

  assert.match(startupSource, /createAgentSessionServices\(/);
  assert.match(startupSource, /createAgentSessionFromServices\(/);
  assert.doesNotMatch(startupSource, /await createAgentSession\(/);
});

async function loadSubject() {
  return import("./rpc-manager.ts");
}

function createInner(bindExtensions) {
  return {
    sessionId: "test-session",
    sessionFile: "",
    isStreaming: false,
    isCompacting: false,
    isBashRunning: false,
    agent: { state: { systemPrompt: "" } },
    extensionRunner: {},
    subscribe: () => () => {},
    bindExtensions,
  };
}

test("extension custom UI receives terminal dimensions", async () => {
  const { AgentSessionWrapper } = await loadSubject();
  let capturedTui;
  const wrapper = new AgentSessionWrapper(createInner(async ({ uiContext }) => {
    uiContext.custom((tui) => {
      capturedTui = tui;
      return { render: () => [`rows:${tui.terminal.rows}`] };
    });
  }));
  const rendered = new Promise((resolve) => {
    wrapper.onEvent((event) => {
      if (event.type === "extension_ui_request" && event.method === "custom") resolve(event);
    });
  });

  wrapper.beginExtensionBinding();
  const event = await rendered;

  assert.equal(capturedTui.terminal.columns, 92);
  assert.equal(capturedTui.terminal.rows, 999);
  assert.deepEqual(event.lines, ["rows:999"]);
});
