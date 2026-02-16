import { withSiwa, siwaOptions } from "@buildersgarden/siwa-ts/next";

export const GET = withSiwa(async (agent) => {
  return {
    message: `Hello Agent #${agent.agentId}!`,
    address: agent.address,
    agentId: agent.agentId,
    timestamp: new Date().toISOString(),
  };
});

export { siwaOptions as OPTIONS };
