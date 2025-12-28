/**
 * Host App Context
 * Provides host app detection, terminology, and label colors
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { evalTS } from "../../js/lib/utils/bolt";
import type { HostApp, HostTerms } from "../../domain/types";
import { TERMS, DEFAULT_LABEL_COLORS } from "../../domain";

// ===== Context Types =====

interface HostAppContextValue {
  hostApp: HostApp;
  terms: HostTerms;
  labelColors: string[];
  getLabelColorCSS: (colorIndex: number | undefined) => string | undefined;
  isLoading: boolean;
}

// ===== Default Values =====

const defaultContext: HostAppContextValue = {
  hostApp: "aeft",
  terms: TERMS.aeft,
  labelColors: [],
  getLabelColorCSS: () => undefined,
  isLoading: true,
};

// ===== Context =====

const HostAppContext = createContext<HostAppContextValue>(defaultContext);

// ===== Host App Detection =====

const detectHostApp = (): HostApp => {
  if (typeof window !== "undefined" && window.cep) {
    try {
      // @ts-ignore - CSInterface is available in CEP environment
      const hostId = new CSInterface().hostEnvironment?.appId;
      if (hostId === "PPRO") return "ppro";
    } catch (e) {
      // Fallback to AEFT
    }
  }
  return "aeft";
};

// ===== Provider Component =====

interface HostAppProviderProps {
  children: ReactNode;
}

export function HostAppProvider({ children }: HostAppProviderProps) {
  const [hostApp] = useState<HostApp>(() => detectHostApp());
  const [labelColors, setLabelColors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get terms for current host app
  const terms = TERMS[hostApp];

  // Fetch label colors from host app
  useEffect(() => {
    const fetchLabelColors = async () => {
      try {
        const colors = await evalTS("getLabelColors");
        if (colors && colors.length > 0) {
          setLabelColors(colors);
          // Update CSS variables
          colors.forEach((color: string, index: number) => {
            if (color) {
              document.documentElement.style.setProperty(
                `--label-color-${index + 1}`,
                color
              );
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch label colors:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabelColors();
  }, []);

  // Get CSS color for label index
  const getLabelColorCSS = (colorIndex: number | undefined): string | undefined => {
    if (!colorIndex) return undefined;

    // Use dynamic colors if available
    if (labelColors.length >= colorIndex && labelColors[colorIndex - 1]) {
      return labelColors[colorIndex - 1];
    }

    // Fallback to default colors
    return DEFAULT_LABEL_COLORS[colorIndex];
  };

  const value: HostAppContextValue = {
    hostApp,
    terms,
    labelColors,
    getLabelColorCSS,
    isLoading,
  };

  return (
    <HostAppContext.Provider value={value}>
      {children}
    </HostAppContext.Provider>
  );
}

// ===== Hook =====

export function useHostApp() {
  const context = useContext(HostAppContext);
  if (!context) {
    throw new Error("useHostApp must be used within HostAppProvider");
  }
  return context;
}

// ===== Exports =====

export { HostAppContext };
export type { HostAppContextValue };
