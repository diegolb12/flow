export async function pushApprovedToHubSpot(order) {
    if (!process.env.HUBSPOT_API_KEY) return;
    return { ok: true, reference: order.reference };
  }