#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function printUsage() {
  console.log(`Usage:
  node scripts/tanstack-mcp.mjs list-tools
  node scripts/tanstack-mcp.mjs call-tool <toolName> [jsonArgs]

Examples:
  node scripts/tanstack-mcp.mjs list-tools
  node scripts/tanstack-mcp.mjs call-tool tanstack_search_docs '{"query":"hydration","library":"start","framework":"react","limit":3}'
`);
}

class McpStdioClient {
  constructor(command, args, options = {}) {
    this.command = command;
    this.args = args;
    this.options = options;
    this.process = null;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.process = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.options.cwd || process.cwd(),
      env: { ...process.env, ...(this.options.env || {}) },
    });

    this.process.stdout.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.#drainBuffer();
    });

    this.process.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text.length > 0 && this.options.debug) {
        console.error(`[mcp stderr] ${text}`);
      }
    });

    this.process.on("error", (error) => {
      this.#rejectAll(
        new Error(`Failed to start MCP process: ${error.message}`),
      );
    });

    this.process.on("exit", (code, signal) => {
      this.#rejectAll(
        new Error(
          `MCP process exited (code=${String(code)}, signal=${String(signal)})`,
        ),
      );
    });
  }

  close() {
    if (!this.process) return;
    if (!this.process.killed) {
      this.process.kill("SIGTERM");
    }
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "lumi-tanstack-mcp-script",
        version: "1.0.0",
      },
    });

    this.notify("notifications/initialized", {});
    return result;
  }

  request(method, params = {}) {
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.#send({
        jsonrpc: "2.0",
        id,
        method,
        params,
      });
    });
  }

  notify(method, params = {}) {
    this.#send({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  #send(message) {
    const stdin = this.process?.stdin;
    if (!stdin || !stdin.writable) {
      throw new Error("MCP process is not writable");
    }

    stdin.write(`${JSON.stringify(message)}\n`);
  }

  #drainBuffer() {
    while (true) {
      const isContentLengthFramed =
        this.buffer.indexOf("Content-Length:") === 0;

      let messageText;

      if (isContentLengthFramed) {
        const headerEndIndex = this.buffer.indexOf("\r\n\r\n");
        if (headerEndIndex === -1) return;

        const header = this.buffer.slice(0, headerEndIndex).toString("utf8");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          this.buffer = this.buffer.slice(headerEndIndex + 4);
          continue;
        }

        const contentLength = Number(match[1]);
        const messageEndIndex = headerEndIndex + 4 + contentLength;
        if (this.buffer.length < messageEndIndex) return;

        messageText = this.buffer
          .slice(headerEndIndex + 4, messageEndIndex)
          .toString("utf8");
        this.buffer = this.buffer.slice(messageEndIndex);
      } else {
        const newlineIndex = this.buffer.indexOf("\n");
        if (newlineIndex === -1) return;

        messageText = this.buffer
          .slice(0, newlineIndex)
          .toString("utf8")
          .replace(/\r$/, "")
          .trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);

        if (!messageText) continue;
        if (!messageText.startsWith("{")) {
          if (this.options.debug) {
            console.error(`[mcp stdout noise] ${messageText}`);
          }
          continue;
        }
      }

      let message;
      try {
        message = JSON.parse(messageText);
      } catch (error) {
        this.#rejectAll(
          new Error(
            `Failed to parse MCP message: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        return;
      }

      this.#handleMessage(message);
    }
  }

  #handleMessage(message) {
    if (Object.hasOwn(message, "id")) {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(
          new Error(
            `MCP error ${String(message.error.code)}: ${String(message.error.message)}`,
          ),
        );
        return;
      }

      pending.resolve(message.result);
    }
  }

  #rejectAll(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function parseJsonArgs(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("JSON args must be an object");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid jsonArgs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function getLatestNpxTanstackCliBin() {
  const root = path.join(os.homedir(), ".npm", "_npx");
  if (!fs.existsSync(root)) return null;

  const candidatePaths = [];
  for (const entry of fs.readdirSync(root)) {
    const full = path.join(
      root,
      entry,
      "node_modules",
      "@tanstack",
      "cli",
      "dist",
      "bin.js",
    );
    if (fs.existsSync(full)) {
      candidatePaths.push(full);
    }
  }

  if (candidatePaths.length === 0) return null;

  candidatePaths.sort((a, b) => {
    const aStat = fs.statSync(a);
    const bStat = fs.statSync(b);
    return bStat.mtimeMs - aStat.mtimeMs;
  });

  return candidatePaths[0];
}

function resolveMcpCommand() {
  const commandOverride = process.env.TANSTACK_MCP_COMMAND;
  const argsOverride = process.env.TANSTACK_MCP_ARGS;

  if (commandOverride) {
    return {
      command: commandOverride,
      args: argsOverride ? JSON.parse(argsOverride) : [],
      source: "env override",
    };
  }

  const localBin = getLatestNpxTanstackCliBin();
  if (localBin) {
    return {
      command: process.execPath,
      args: [localBin, "mcp"],
      source: "local npm cache",
    };
  }

  return {
    command: "npx",
    args: ["-y", "@tanstack/cli", "mcp"],
    source: "npx",
  };
}

async function main() {
  const [command, toolName, rawJsonArgs] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const mcp = resolveMcpCommand();
  const client = new McpStdioClient(mcp.command, mcp.args, {
    cwd: process.cwd(),
    debug: Boolean(process.env.DEBUG_MCP),
  });

  try {
    if (process.env.DEBUG_MCP) {
      console.error(
        `Using MCP command (${mcp.source}): ${mcp.command} ${mcp.args.join(" ")}`,
      );
    }
    client.start();
    await client.initialize();

    if (command === "list-tools") {
      const result = await client.request("tools/list", {});
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "call-tool") {
      if (!toolName) {
        throw new Error("Missing <toolName> for call-tool");
      }
      const args = parseJsonArgs(rawJsonArgs);
      const result = await client.request("tools/call", {
        name: toolName,
        arguments: args,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
