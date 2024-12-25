import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import { getRacerStatistics } from '../../graphql/queries';
import {
  ColumnConfiguration,
  FilteringProperties,
} from './support-functions/racerStatsTableConfig';

export const RacerStats = () => {
  const { t } = useTranslation(['translation', 'help-racer-stats']);
  const [SelectedUserRacesInTable, setSelectedUserRacesInTable] = useState([]);
  const [UserRaces, setUserRaces] = useState([]);
  let racerStatsIsLoading = false;

  useEffect(() => {
    console.debug('UserRaces:', UserRaces);
    async function queryApi() {
      const response = await API.graphql(
        graphqlOperation(getRacerStatistics, { userId: '02a5c464-c0b1-70ee-e1d0-700cec521237' })
      );

      const data = response.data.getRacerStatistics;
      console.debug(data);
      setUserRaces(data);
      racerStatsIsLoading = true;
    }
    queryApi();
  }, []);

  // Table config
  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

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
    >
      <PageTable
        selectedItems={SelectedUserRacesInTable}
        setSelectedItems={setSelectedUserRacesInTable}
        tableItems={UserRaces}
        selectionType="single"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={SelectedUserRacesInTable.length}
            nrTotalItems={UserRaces.length}
            header={t('racer-stats.table')}
            // actions={<HeaderActionButtons />}
          />
        }
        itemsIsLoading={racerStatsIsLoading}
        loadingText={t('racer-stats.loading')}
        localStorageKey={'racer-stats-table-preferences'}
        trackBy={'raceId'}
        filteringProperties={filteringProperties}
        filteringI18nStringsName={'racer-stats'}
      />
    </PageLayout>
  );
};
