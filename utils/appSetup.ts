// utils/appSetup.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shop, Currencies } from '@/src/@types/models';

// ─── Clés de stockage ─────────────────────────────────────────────────────────

export const APP_SETUP_KEYS = {
  COMPLETE     : 'APP:SETUP_COMPLETE',
  SHOP_ID      : 'APP:SHOP_ID',
  SHOP         : 'APP:SHOP',
  CURRENCY     : 'APP:CURRENCY',
  SETUP_AT     : 'APP:SETUP_AT',
  SETUP_BY_ID  : 'APP:SETUP_BY_ID',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SetupConfig = {
  shopId    : string;
  shop      : Shop;
  currency  : Currencies;
  setupAt   : number;
  setupById : number;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export const AppSetup = {

  /** L'app a-t-elle déjà été configurée ? */
  async isComplete(): Promise<boolean> {
    const v = await AsyncStorage.getItem(APP_SETUP_KEYS.COMPLETE);
    return v === 'true';
  },

  /** Lit la config sauvegardée (peut être partielle si setup interrompu) */
  async getConfig(): Promise<Partial<SetupConfig>> {
    const [shopId, shopRaw, currencyRaw, setupAt, setupById] =
      await AsyncStorage.multiGet([
        APP_SETUP_KEYS.SHOP_ID,
        APP_SETUP_KEYS.SHOP,
        APP_SETUP_KEYS.CURRENCY,
        APP_SETUP_KEYS.SETUP_AT,
        APP_SETUP_KEYS.SETUP_BY_ID,
      ]).then(pairs => pairs.map(([, v]) => v));

    return {
      shopId    : shopId      ?? undefined,
      shop      : shopRaw     ? JSON.parse(shopRaw)     : undefined,
      currency  : currencyRaw ? JSON.parse(currencyRaw) : undefined,
      setupAt   : setupAt     ? Number(setupAt)         : undefined,
      setupById : setupById   ? Number(setupById)       : undefined,
    };
  },

  /** Persiste la configuration et marque le setup comme terminé */
  async save(config: SetupConfig): Promise<void> {
    await AsyncStorage.multiSet([
      [APP_SETUP_KEYS.COMPLETE,    'true'                        ],
      [APP_SETUP_KEYS.SHOP_ID,     String(config.shopId)         ],
      [APP_SETUP_KEYS.SHOP,        JSON.stringify(config.shop)   ],
      [APP_SETUP_KEYS.CURRENCY,    JSON.stringify(config.currency)],
      [APP_SETUP_KEYS.SETUP_AT,    String(config.setupAt)        ],
      [APP_SETUP_KEYS.SETUP_BY_ID, String(config.setupById)      ],
    ]);
  },

  /** Efface toute la configuration (factory reset) */
  async reset(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(APP_SETUP_KEYS));
  },
};