export async function collectPublicHospitalCandidates({ serviceKey }) {
  if (!serviceKey) {
    return {
      items: [],
      warnings: ['PUBLIC_DATA_SERVICE_KEY is not configured; skipped public data enrichment.'],
    };
  }

  return {
    items: [],
    warnings: ['No public animal hospital endpoints are configured yet; skipped public data enrichment.'],
  };
}
