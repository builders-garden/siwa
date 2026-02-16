import { withSiwa, siwaOptions } from "@buildersgarden/siwa-ts/next";

export const POST = withSiwa(async (agent, req) => {
  const body = await req.json();

  return {
    received: body,
    processedBy: "siwa-server",
    agent: { address: agent.address, agentId: agent.agentId },
    timestamp: new Date().toISOString(),
  };
});

export { siwaOptions as OPTIONS };
