// Source plugins
export { mockDataPlugin, createMockEventStream } from "./sources/mockData";
export { OpenClawGatewayClient } from "./sources/openclawGateway";
export type { GatewayClientOptions, GatewayConnectionState } from "./sources/openclawGateway";

// NOTE: fs-based connectors (jsonlTail, codexSessions, claudeCode) and the
// copilot credentials store are intentionally NOT exported from this barrel —
// the app imports the barrel client-side. Import them via deep paths
// (@diorama/plugins/sources/codexSessions, …) from server code only.

// Theme plugins
export { neonDarkTheme, warmOfficeTheme, minimalTheme, cyberpunkTheme, applyTheme } from "./themes/themes";
