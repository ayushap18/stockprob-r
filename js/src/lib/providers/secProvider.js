import { providerFail, providerOk } from './demoProvider.js';

export async function fetchSecFilings(symbol) {
  if (!process.env.SEC_USER_AGENT) return providerFail(new Error('SEC_USER_AGENT not configured'), 'sec', 0);
  return providerOk({ symbol, filings: [] }, 'sec', 0, ['SEC filing lookup adapter is configured as a safe stub until CIK mapping is persisted.']);
}
