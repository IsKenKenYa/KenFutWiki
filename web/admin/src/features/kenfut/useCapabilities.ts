import { useEffect, useState } from 'react';
import { getCapabilities } from './api';
import type { Capabilities } from './types';

let pending: Promise<Capabilities> | undefined;
function loadCapabilities() {
  pending ??= getCapabilities().catch(error => {
    pending = undefined;
    throw error;
  });
  return pending;
}

export default function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  useEffect(() => {
    let active = true;
    loadCapabilities()
      .then(value => {
        if (active) setCapabilities(value);
      })
      .catch(() => {
        // Preserve the upstream restrictions while the capability service is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);
  return capabilities;
}
