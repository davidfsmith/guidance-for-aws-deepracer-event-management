import React from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';

export const RacerStats = () => {
  const { t } = useTranslation(['translation', 'help-racer-stats']);

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-racer-stats' })}
          bodyContent={t('content', { ns: 'help-racer-stats' })}
          footerContent={t('footer', { ns: 'help-racer-stats' })}
        />
      }
      header={t('racer-stats.header')}
      description={t('racer-stats.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('racer-stats.breadcrumb') },
      ]}
    ></PageLayout>
  );
};
