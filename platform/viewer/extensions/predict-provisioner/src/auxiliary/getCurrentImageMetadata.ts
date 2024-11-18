import { DicomMetadataStore } from '@ohif/core';

import getActiveDisplayUIDSet from './getActiveDisplayUIDSet';

export default ({ servicesManager }) => {
  const { uiNotificationService } = servicesManager.services;

  if (DicomMetadataStore === undefined) {
    uiNotificationService.show({
      title: 'Unable to Fetch Metadata',
      message: 'DicomMetadataStore service is not available.',
      type: 'error',
      duration: 5000,
    });

    return;
  }

  const activeDisplayUIDSet = getActiveDisplayUIDSet({ servicesManager });

  if (activeDisplayUIDSet === undefined) {
    uiNotificationService.show({
      title: 'Unable to Access Screen',
      message: 'No active viewport found.',
      type: 'error',
      duration: 5000,
    });

    return;
  }

  const firstImageMetadata = DicomMetadataStore.getSeries(
    activeDisplayUIDSet.study_uid,
    activeDisplayUIDSet.series_id
  ).instances[0];

  return Object.keys(firstImageMetadata).reduce((acc, key) => {
    acc[key] = firstImageMetadata[key];

    return acc;
  }, {});
};
