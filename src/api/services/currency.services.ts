// src/api/services/currency.service.ts
import apiClient from '../client';
import { ApiResponse, Currencies } from '@/src/@types/models';

// ─── Fallback statique si l'API ne répond pas ─────────────────────────────────

export const COMMON_CURRENCIES: Currencies[] = [
  { id: 1,  iso_code: 'USD', symbol: '$',   name: 'Dollar américain',    country: 'US',  exchange_rate: 1    },
  { id: 2,  iso_code: 'EUR', symbol: '€',   name: 'Euro',                country: 'EU',  exchange_rate: 0.92 },
  { id: 3,  iso_code: 'HTG', symbol: 'G',   name: 'Gourde haïtienne',    country: 'HT',  exchange_rate: 132  },
  { id: 4,  iso_code: 'GBP', symbol: '£',   name: 'Livre sterling',       country: 'GB',  exchange_rate: 0.79 },
  { id: 5,  iso_code: 'CAD', symbol: 'CA$', name: 'Dollar canadien',      country: 'CA',  exchange_rate: 1.36 },
  { id: 6,  iso_code: 'XOF', symbol: 'CFA', name: 'Franc CFA (UEMOA)',    country: 'SN',  exchange_rate: 605  },
  { id: 7,  iso_code: 'XAF', symbol: 'CFA', name: 'Franc CFA (CEMAC)',    country: 'CM',  exchange_rate: 605  },
  { id: 8,  iso_code: 'MAD', symbol: 'DH',  name: 'Dirham marocain',      country: 'MA',  exchange_rate: 10   },
  { id: 9,  iso_code: 'DZD', symbol: 'DA',  name: 'Dinar algérien',       country: 'DZ',  exchange_rate: 135  },
  { id: 10, iso_code: 'TND', symbol: 'DT',  name: 'Dinar tunisien',       country: 'TN',  exchange_rate: 3.1  },
];

export const currencyService = {
  /**
   * Tente de récupérer les devises depuis l'API.
   * Si l'API échoue, retourne la liste statique.
   */
  async list(): Promise<Currencies[]> {
    try {
      const response = await apiClient.get<ApiResponse<Currencies[]>>('/currencies');
      const data = (response as any).data;
      if (Array.isArray(data) && data.length > 0) return data;
      return COMMON_CURRENCIES;
    } catch {
      return COMMON_CURRENCIES;
    }
  },
};