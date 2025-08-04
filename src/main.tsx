import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useThemeStore } from './store/themeStore';

const Root = () => {
  const { darkMode } = useThemeStore();

  // ✅ Solo este efecto controla la clase "dark"
  useEffect(() => {
    console.log('🔄 Sincronizando clase dark. Estado:', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
};

createRoot(document.getElementById('root')!).render(<Root />);
