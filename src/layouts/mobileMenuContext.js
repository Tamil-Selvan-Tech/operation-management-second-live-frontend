import { createContext, useContext } from 'react'

export const MobileMenuContext = createContext(() => {})

export function useMobileMenu() {
  return useContext(MobileMenuContext)
}
