import { useEffect, useState } from 'react';

// Captures Chrome/Edge/Android's install prompt and detects iOS (which has no prompt API).
export function useInstall() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
  );

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  async function install() {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    if (outcome === 'accepted') setInstalled(true);
    return true;
  }

  return {
    installed,
    // Show the button when the browser offers install, or on iOS Safari (manual steps)
    canInstall: !installed && (!!promptEvent || isIOS),
    hasPrompt: !!promptEvent,
    isIOS,
    install,
  };
}
