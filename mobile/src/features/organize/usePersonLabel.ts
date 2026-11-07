import { useTranslation } from 'react-i18next';

import { usePartner } from '@/features/couple/usePartner';

/** "Moi" / the partner's name / "Nous" for a relative person. */
export function usePersonLabel(): (person: 'me' | 'you' | 'us') => string {
  const { t } = useTranslation();
  const partner = usePartner();
  return (person) =>
    person === 'you'
      ? (partner?.display_name ?? t('organize.people.us'))
      : t(`organize.people.${person}`);
}
