import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSetup, SetupConfig } from '@/utils/appSetup';

// ─── Types ──────────────────────────────────────────────────────────────────

type AppSetupContextType = {
  isSetupComplete  : boolean;
  isCheckingSetup  : boolean;
  setupConfig      : Partial<SetupConfig>;
  completeSetup    : (config: SetupConfig) => Promise<void>;
  resetSetup       : () => Promise<void>;            
};

//  ─── Context ────────────────────────────────────────────────────────────────── 

const AppSetupContext = createContext<AppSetupContextType>({
  isSetupComplete  : false,
  isCheckingSetup  : true,
  setupConfig      : {},
  completeSetup    : async () => {},
  resetSetup       : async () => {},
});

export const useAppSetup = () => useContext(AppSetupContext);

// ─── Provider ───────────────────────────────────────────────────────────────── 

export const AppSetupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupConfig, setSetupConfig]         = useState<Partial<SetupConfig>>({});

  // Lecture du storage au montage
  useEffect(() => {
    (async () => {
      const complete = await AppSetup.isComplete();
      if (complete) {
        const config = await AppSetup.getConfig();
        setSetupConfig(config);
      }
      setIsSetupComplete(complete);
      setIsCheckingSetup(false);
    })();
  }, []);

  // Appelé quand le wizard de setup est terminé 
  const completeSetup = async (config: SetupConfig) => {
    await AppSetup.save(config);
    setSetupConfig(config);
    setIsSetupComplete(true);
  };

  // Factory reset (menu admin) 
  const resetSetup = async () => {
    await AppSetup.reset();
    setSetupConfig({});
    setIsSetupComplete(false);
  };

  return (
    <AppSetupContext.Provider
      value={{ isSetupComplete, isCheckingSetup, setupConfig, completeSetup, resetSetup }}
    >
      {children}
    </AppSetupContext.Provider>
  );
};

export default AppSetupProvider;