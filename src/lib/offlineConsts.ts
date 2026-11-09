/** Plain constants for the offline flow (no Firebase imports, so server code can use them too). */
export type OfflineType = 'car' | 'bike'

/** "Up to" cashback shown for offline requests. */
export const OFFLINE_CASHBACK: Record<OfflineType, number> = { car: 500, bike: 300 }

export const INSURERS = [
  'Acko General', 'Bajaj Allianz', 'Cholamandalam MS', 'Digit', 'Future Generali', 'HDFC ERGO', 'ICICI Lombard',
  'IFFCO Tokio', 'Kotak General', 'Liberty General', 'National Insurance', 'New India Assurance', 'Oriental Insurance',
  'Raheja QBE', 'Reliance General', 'Royal Sundaram', 'SBI General', 'Shriram General', 'Tata AIG', 'United India',
  'Universal Sompo', 'Zuno General', 'Other / not sure',
]
export const PREV_POLICY_TYPES = ['Comprehensive', 'Third Party', 'Own Damage only', 'Not sure']
export const NCB_OPTIONS = ['0%', '20%', '25%', '35%', '45%', '50%']

