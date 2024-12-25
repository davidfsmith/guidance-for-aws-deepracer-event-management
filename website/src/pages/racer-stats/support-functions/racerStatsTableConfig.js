import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';

export const ColumnConfiguration = () => {
  var returnObject = {
    defaultVisibleColumns: ['createdAt', 'eventId', 'raceId'],
    visibleContentOptions: [
      {
        label: i18next.t('events.events-information'),
        options: [
          {
            id: 'createdAt',
            label: i18next.t('createdAt'),
            editable: false,
          },
          {
            id: 'eventId',
            label: i18next.t('eventId'),
          },
          {
            id: 'raceId',
            label: i18next.t('raceId'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'createdAt',
        header: i18next.t('racer-stats.createdAt'),
        cell: (item) => formatAwsDateTime(item.createdAt) || '-',
        sortingField: 'createdAt',
      },
      {
        id: 'eventId',
        header: i18next.t('racer-stats.eventId'),
        cell: (item) => item.eventId || '-',
        sortingField: 'eventId',
      },
      {
        id: 'raceId',
        header: i18next.t('racer-stats.raceId'),
        cell: (item) => item.raceId || '-',
        sortingField: 'raceId',
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[0]; // createdAt
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringProperties = () => {
  return [
    {
      key: 'eventId',
      propertyLabel: i18next.t('eventId'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
