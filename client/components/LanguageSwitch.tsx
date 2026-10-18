import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import type { Lang } from '../lang';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={i18n.resolvedLanguage}
      onChange={(_, lang: Lang | null) => lang && setLanguage(lang)}
      aria-label={t('common.switch')}
      sx={{ position: 'fixed', left: 4, bottom: 4, opacity: 0.6 }}
    >
      <ToggleButton value="de" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
        DE
      </ToggleButton>
      <ToggleButton value="en" sx={{ px: 1, py: 0.25, fontSize: 12 }}>
        EN
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
