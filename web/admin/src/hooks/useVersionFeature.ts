import {
  FeatureStatus,
  VersionInfoMap,
  VersionInfo,
  getFeatureValue,
} from '@/constant/version';
import { ConstsLicenseEdition } from '@/request/types';
import { useAppSelector } from '@/store';
import useCapabilities from '@/features/kenfut/useCapabilities';

export const useFeatureValue = <K extends keyof VersionInfo['features']>(
  key: K,
): VersionInfo['features'][K] => {
  const { license } = useAppSelector(state => state.config);
  const capabilities = useCapabilities();
  if (key === 'wikiCount' && capabilities)
    return (
      capabilities.limits.max_kb > 0
        ? capabilities.limits.max_kb
        : Number.POSITIVE_INFINITY
    ) as VersionInfo['features'][K];
  if (key === 'docCountPerWiki' && capabilities)
    return (
      capabilities.limits.max_node > 0
        ? capabilities.limits.max_node
        : Number.POSITIVE_INFINITY
    ) as VersionInfo['features'][K];
  if (key === 'adminCount' && capabilities)
    return (
      capabilities.limits.max_admin > 0
        ? capabilities.limits.max_admin
        : Number.POSITIVE_INFINITY
    ) as VersionInfo['features'][K];
  return getFeatureValue(license.edition!, key);
};

export const useFeatureValueSupported = (
  key: keyof VersionInfo['features'],
) => {
  const { license } = useAppSelector(state => state.config);
  return (
    getFeatureValue(license.edition!, key) === FeatureStatus.SUPPORTED ||
    getFeatureValue(license.edition!, key) === FeatureStatus.ADVANCED
  );
};

export const useVersionInfo = () => {
  const { license } = useAppSelector(state => state.config);
  return (
    VersionInfoMap[
      license.edition ?? ConstsLicenseEdition.LicenseEditionFree
    ] || VersionInfoMap[ConstsLicenseEdition.LicenseEditionFree]
  );
};
