import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import { initializeBase64Wasm } from "@automerge/automerge/slim";

await initializeBase64Wasm(automergeWasmBase64);

export * from "@automerge/automerge/slim";
