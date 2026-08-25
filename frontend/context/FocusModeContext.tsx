"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// وضع التركيز: لما يبقى true، بنخفي السايدبار وهيدر الداشبورد
// عشان الطالب يحل الامتحان/الواجب على شاشة كاملة (مهم على الموبايل)
interface FocusModeContextType {
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
}

const FocusModeContext = createContext<FocusModeContextType>({
  focusMode: false,
  setFocusMode: () => {},
});

export function useFocusMode() {
  return useContext(FocusModeContext);
}

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusMode] = useState(false);
  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
}
