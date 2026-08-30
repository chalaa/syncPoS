import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const chromeBin = process.env.CHROME_BIN ?? "/usr/bin/google-chrome-stable";
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9222);

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(childProcess) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    childProcess.once("exit", resolve);
    setTimeout(resolve, 3000);
  });
}

async function removeProfile(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }

      await delay(250);
    }
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

async function waitForChrome() {
  const url = `http://127.0.0.1:${debugPort}/json/version`;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      return await fetchJson(url);
    } catch {
      await delay(250);
    }
  }

  throw new Error("Chrome DevTools endpoint did not become available.");
}

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);

    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);

      if (payload.error) {
        reject(new Error(payload.error.message));
      } else {
        resolve(payload.result);
      }

      return;
    }

    const eventListeners = listeners.get(payload.method) ?? [];
    for (const listener of eventListeners) {
      listener(payload.params ?? {});
    }
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) ?? []), listener]);
    },
    close() {
      socket.close();
    },
  };
}

async function createPage() {
  await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });
  const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
  const target = targets.find((item) => item.type === "page");

  assertCondition(target?.webSocketDebuggerUrl, "Could not open Chrome page target.");

  return createCdpClient(target.webSocketDebuggerUrl);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  }

  return result.result?.value;
}

async function waitForCondition(client, expression, message) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const matched = await evaluate(client, `Boolean(${expression})`);

    if (matched) {
      return;
    }

    await delay(250);
  }

  throw new Error(message);
}

async function navigate(client, path, expectedText) {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  await client.send("Page.navigate", { url });
  await waitForCondition(client, "document.readyState === 'complete'", `Page did not finish loading: ${path}`);

  if (expectedText) {
    await waitForCondition(
      client,
      `document.body && document.body.innerText.includes(${JSON.stringify(expectedText)})`,
      `Expected text not found on ${path}: ${expectedText}`,
    );
  }

  return evaluate(client, "document.body.innerText");
}

async function login(client) {
  await navigate(client, "/login", "Sign in");
  await evaluate(
    client,
    `(() => {
      document.querySelector('input[name="username"]').value = 'admin';
      document.querySelector('input[name="password"]').value = 'admin123';
      document.querySelector('form').requestSubmit();
      return true;
    })()`,
  );
  await waitForCondition(
    client,
    "location.pathname.startsWith('/admin') && document.body.innerText.includes('Products')",
    "Login did not redirect to the admin area.",
  );
}

async function main() {
  const userDataDir = await mkdtemp(join(tmpdir(), "syncpos-chrome-e2e-"));
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: "ignore",
  });

  const consoleErrors = [];
  const visited = [];
  let client;

  try {
    await waitForChrome();
    client = await createPage();
    await client.ready;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");

    client.on("Runtime.exceptionThrown", (params) => {
      consoleErrors.push(params.exceptionDetails?.text ?? "Runtime exception");
    });
    client.on("Log.entryAdded", (params) => {
      if (["error", "warning"].includes(params.entry?.level)) {
        consoleErrors.push(params.entry.text);
      }
    });

    await login(client);
    visited.push("/login -> /admin/products");

    const pages = [
      ["/admin/sales", "Quotations / Orders"],
      ["/admin/sales/new", "New Quotation"],
      ["/admin/sales?view=deliveries", "Deliveries"],
      ["/admin/sales?view=invoices", "Invoices"],
      ["/admin/sales?view=payments", "Payments"],
      ["/admin/purchasing", "RFQs / Orders"],
      ["/admin/purchasing/new", "New Request for Quotation"],
      ["/admin/purchasing?view=receipts", "Receipts"],
      ["/admin/purchasing?view=supplier-bills", "Vendor Bills"],
      ["/admin/purchasing?view=payments", "Payments"],
      ["/admin/inventory", "Stock Workspace"],
      ["/admin/inventory/operations", "Operations"],
      ["/admin/inventory/operations?view=receipts", "Receipts"],
      ["/admin/inventory/operations?view=deliveries", "Deliveries"],
      ["/admin/inventory/transfers/new", "New Transfer"],
      ["/admin/reports", "Reports"],
    ];

    for (const [path, expectedText] of pages) {
      const text = await navigate(client, path, expectedText);
      visited.push(path);

      assertCondition(!text.includes("Application error"), `Application error shown on ${path}.`);
      assertCondition(!text.includes("Unhandled Runtime Error"), `Unhandled runtime error shown on ${path}.`);
    }

    const inventoryText = await navigate(client, "/admin/inventory", "Operations");
    if (!inventoryText.includes("Stock Card")) {
      await evaluate(
        client,
        `(() => {
          const summary = document.querySelector('header details summary');
          if (summary) summary.click();
          return true;
        })()`,
      );
    }
    const expandedInventoryText = await evaluate(client, "document.body.innerText");
    assertCondition(expandedInventoryText.includes("Stock Card"), "Inventory top menu is missing Stock Card.");
    assertCondition(expandedInventoryText.includes("Opening Stock"), "Inventory top menu is missing Opening Stock.");

    const receiptOperationText = await navigate(client, "/admin/inventory/operations?view=receipts", "Receipts");
    assertCondition(
      !receiptOperationText.includes("New Operation"),
      "Receipt operation page should not show New Operation.",
    );

    const deliveryOperationText = await navigate(client, "/admin/inventory/operations?view=deliveries", "Deliveries");
    assertCondition(
      !deliveryOperationText.includes("New Operation"),
      "Delivery operation page should not show New Operation.",
    );

    const adjustmentOperationText = await navigate(client, "/admin/inventory/operations?view=adjustments", "Adjustments");
    assertCondition(
      adjustmentOperationText.includes("New Operation"),
      "Adjustment operation page should show New Operation.",
    );

    assertCondition(consoleErrors.length === 0, `Browser console errors:\n${consoleErrors.join("\n")}`);

    console.log("E2E UI navigation test passed.");
    console.log(`Visited ${visited.length} routes after login.`);
    for (const path of visited) {
      console.log(`- ${path}`);
    }
  } finally {
    client?.close();
    chrome.kill("SIGTERM");
    await waitForProcessExit(chrome);
    await removeProfile(userDataDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
