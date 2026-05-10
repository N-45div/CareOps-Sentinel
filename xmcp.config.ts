import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  paths: {
    tools: "src/tools",
    prompts: false,
    resources: false
  },
  http: {
    port: Number(process.env.PORT ?? 3001),
    host: "0.0.0.0",
    endpoint: "/mcp",
    bodySizeLimit: 10485760,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id", "mcp-protocol-version"],
      exposedHeaders: ["Content-Type", "Authorization", "mcp-session-id"],
      credentials: false,
      maxAge: 86400
    }
  }
};

export default config;
