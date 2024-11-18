import * as React from 'react';
import { PanelSection, Button } from '@ohif/ui';

import WrappedSelect from './WrappedSelect';
import getActiveDisplayUIDSet from '../auxiliary/getActiveDisplayUIDSet';

export default ({ status, setStatus, setAnalysis, servicesManager }) => {
  const [availableMasks, setAvailableMasks] = React.useState<Record<string, any>>({});
  const [selectedMask, setSelectedMask] = React.useState<Record<string, any>>({
    value: undefined,
    label: undefined,
  });
  const [selectedTruth, setSelectedTruth] = React.useState<Record<string, any>>({
    value: undefined,
    label: undefined,
  });

  const isProcessing = () => !Object.values(status).every(x => x === false);
  const isAnalysisAvailable = () =>
    selectedMask.value !== undefined &&
    selectedTruth.value !== undefined &&
    isProcessing() === false &&
    status.calculating === false;

  const getAvailableMasks = () => {
    const { displaySetService } = servicesManager.services;

    const activeDisplaySets = displaySetService.getActiveDisplaySets();
    const validDisplaySets = activeDisplaySets.filter(displaySet => displaySet.Modality === 'SEG');

    const displaySetSeries = validDisplaySets.map(displaySet => ({
      uid: displaySet.SeriesInstanceUID,
      description: displaySet.SeriesDescription,
    }));

    const masks = {};
    for (let series of displaySetSeries) masks[series.uid] = series.description;

    setAvailableMasks(masks);
  };

  const calculateDICEScore = async () => {
    const { uiNotificationService } = servicesManager.services;

    let activeDisplayUIDSet;

    try {
      activeDisplayUIDSet = getActiveDisplayUIDSet({ servicesManager });
    } catch (error) {
      console.error(error);

      return;
    }

    if (selectedMask.value === undefined || availableMasks[selectedMask.value] === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a segmentaion to compare.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    if (selectedTruth.value === undefined || availableMasks[selectedTruth.value] === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a ground truth segmentaion to compare against.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    const selectedMaskUIDs = {
      series_desc: availableMasks[selectedMask.value],
      series_uid: selectedMask.value,
      patient_id: activeDisplayUIDSet.patient_id,
      study_id: activeDisplayUIDSet.patient_id,
      study_desc: activeDisplayUIDSet.study_description,
      study_uid: activeDisplayUIDSet.study_uid,
    };

    const selectedTruthUIDs = {
      series_desc: availableMasks[selectedTruth.value],
      series_uid: selectedTruth.value,
      patient_id: activeDisplayUIDSet.patient_id,
      study_id: activeDisplayUIDSet.patient_id,
      study_desc: activeDisplayUIDSet.study_description,
      study_uid: activeDisplayUIDSet.study_uid,
    };

    setStatus({ ...status, calculating: true });

    try {
      const response = await fetch(`/api/getDICEScores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentDicomId: activeDisplayUIDSet.parent_id,
          currentMask: JSON.stringify(selectedMaskUIDs),
          groundTruth: JSON.stringify(selectedTruthUIDs),
        }),
      });

      const body = await response.json();

      setAnalysis(p => {
        p[`${selectedMaskUIDs.series_uid}:${selectedTruthUIDs.series_uid}`] = {
          maskUIDs: selectedMaskUIDs,
          truthUIDs: selectedTruthUIDs,
          scores: body,
        };

        return JSON.parse(JSON.stringify(p));
      });

      uiNotificationService.show({
        title: 'Complete',
        message: `Analysis was a success.`,
        type: 'success',
        duration: 5000,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, calculating: false });
    }
  };

  const saveDiscrepency = async () => {
    const { uiNotificationService } = servicesManager.services;

    let activeDisplayUIDSet;

    try {
      activeDisplayUIDSet = getActiveDisplayUIDSet({ servicesManager });
    } catch (error) {
      console.error(error);

      return;
    }

    if (selectedMask.value === undefined || availableMasks[selectedMask.value] === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a segmentaion to compare.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    if (selectedTruth.value === undefined || availableMasks[selectedTruth.value] === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a ground truth segmentaion to compare against.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    setStatus({ ...status, calculating: true });

    try {
      const response = await fetch(`/api/saveDiscrepancyMask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: activeDisplayUIDSet.parent_id,
          predSeriesUid: selectedMask.value,
          truthSeriesUid: selectedTruth.value,
        }),
      });

      const body = await response.json();

      uiNotificationService.show({
        title: body.saved_mask ? 'Complete' : 'No Discrepancies',
        message: body.message || 'Success',
        type: body.saved_mask ? 'success' : 'warning',
        duration: 5000,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, calculating: false });
    }
  };

  React.useEffect(() => {
    const { displaySetService, uiNotificationService } = servicesManager.services;

    if (displaySetService === undefined) {
      uiNotificationService.show({
        title: 'Unable to Load',
        message: 'Could not load the stored segmentations information.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    const handleDisplaySetsAdded = () => getAvailableMasks();

    displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      handleDisplaySetsAdded
    );

    return () => {
      displaySetService.unsubscribe(
        displaySetService.EVENTS.DISPLAY_SETS_ADDED,
        handleDisplaySetsAdded
      );
    };
  }, [servicesManager]);

  return (
    <PanelSection title="Analysis Tools">
      <WrappedSelect
        label="Predicted Segmentation"
        options={Object.keys(availableMasks).map(uid => ({
          value: uid,
          label: availableMasks[uid],
        }))}
        value={selectedMask}
        onChange={setSelectedMask}
      ></WrappedSelect>

      <WrappedSelect
        label="Ground Truth Segmentation"
        options={Object.keys(availableMasks).map(uid => ({
          value: uid,
          label: availableMasks[uid],
        }))}
        value={selectedTruth}
        onChange={setSelectedTruth}
      ></WrappedSelect>

      <Button
        className="mb-1 mt-1"
        children="Calculate DICE Score"
        onClick={() => calculateDICEScore().catch(console.error)}
        disabled={isAnalysisAvailable() === false}
      ></Button>

      <Button
        className="mb-1 mt-1"
        children="Save Discrepency"
        onClick={() => saveDiscrepency().catch(console.error)}
        disabled={isAnalysisAvailable() === false}
      ></Button>
    </PanelSection>
  );
};
