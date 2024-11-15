import * as React from 'react';

import { DicomMetadataStore } from '@ohif/core';

import ModelRelationPanelSection from './ModelRelationPanelSection';

export default ({ servicesManager }) => {
  const [status, setStatus] = React.useState({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  const getActiveDisplayUIDSet = () => {
    const { viewportGridService, displaySetService } = servicesManager.services;

    const activeViewportId = viewportGridService.getActiveViewportId();
    const activeDisplaySets = displaySetService.getActiveDisplaySets();

    const currentDisplaySet = activeDisplaySets.find(
      displaySet =>
        displaySet.displaySetInstanceUID ===
        viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId)[0]
    );

    const currentStudyInstanceUID = currentDisplaySet?.StudyInstanceUID;
    const currentStudy = DicomMetadataStore.getStudy(currentStudyInstanceUID);
    const currentStudyDescription = currentStudy?.StudyDescription;
    const currentPatientUID = currentStudy?.series[0].PatientID;
    const currentStudyID = currentStudy?.series[0].StudyID;
    const currentStudySlicesSeriesInstanceUID = currentStudy?.series[0].SeriesInstanceUID;
    const currentSeriesInstanceUID = currentDisplaySet?.SeriesInstanceUID;
    const currentSOPInstanceUID = currentDisplaySet?.SOPInstanceUID;

    if (currentSeriesInstanceUID && currentSOPInstanceUID) {
      return {
        is_default_study: false,
        patient_id: currentPatientUID,
        study_id: currentStudyID,
        study_uid: currentStudyInstanceUID,
        study_description: currentStudyDescription,
        series_id: currentSeriesInstanceUID,
        parent_id: currentStudySlicesSeriesInstanceUID,
      };
    }

    const uid = currentDisplaySet?.getUID();

    const referencedDisplaySet = activeDisplaySets.find(
      displaySet => displaySet.referencedVolumeURI === uid
    );

    if (referencedDisplaySet) {
      const segmentationSeriesInstanceUID = referencedDisplaySet?.SeriesInstanceUID;

      return {
        is_default_study: false,
        patient_id: currentPatientUID,
        study_id: currentStudyID,
        study_uid: currentStudyInstanceUID,
        study_description: currentStudyDescription,
        series_id: segmentationSeriesInstanceUID,
        parent_id: currentSeriesInstanceUID,
      };
    }

    return {
      is_default_study: true,
      patient_id: currentPatientUID,
      study_id: currentStudyID,
      study_uid: currentStudyInstanceUID,
      study_description: currentStudyDescription,
      series_id: currentSeriesInstanceUID,
      parent_id: currentSeriesInstanceUID,
    };
  };

  return (
    <div>
      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
        getActiveDisplayUIDSet={getActiveDisplayUIDSet}
      />
    </div>
  );
};
