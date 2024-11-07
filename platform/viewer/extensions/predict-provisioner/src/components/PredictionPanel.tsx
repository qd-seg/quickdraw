import * as React from 'react';

import { Button, PanelSection, ProgressLoadingBar, CheckBox, Select } from '@ohif/ui';
import { MoonLoader, BeatLoader } from 'react-spinners';

import { createReportAsync } from '@ohif/extension-default';
import { DicomMetadataStore } from '@ohif/core';

import io from 'socket.io-client';

const SURROGATE_HOST = '';

const PredictionPanel = ({ servicesManager, commandsManager, extensionManager }) => {
  const { segmentationService, uiNotificationService } = servicesManager.services;

  const [progress, setProgress] = React.useState<number | undefined>(0);

  const [availableModels, setAvailableModels] = React.useState<any[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | undefined>(undefined);

  const [availableMasks, setAvailableMasks] = React.useState<any[]>([]);
  const [selectedMaskIndex, setSelectedMaskIndex] = React.useState<number | undefined>(undefined);

  const [status, setStatus] = React.useState<{ [key: string]: boolean }>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loadingModels: false,
    loadingMasks: false,
  });

  const isActive = () => !Object.values(status).every(x => x === false);
  const isPredictionAvailable = () => selectedModelIndex !== undefined && !isActive();

  const runPrediction = async () => {
    if (!selectedModelIndex) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a model.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    setProgress(0);
    setStatus({ ...status, predicting: true });

    try {
      await fetch(`${SURROGATE_HOST}/api/setupComputeWithModel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModel: availableModels[selectedModelIndex]?.name }),
      });

      await fetch(`${SURROGATE_HOST}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedModel: availableModels[selectedModelIndex]?.name,
          selectedDicomSeries: 'PANCREAS_0005',
        }),
      });
    } catch (error) {
      console.error(error);

      setProgress(0);
    } finally {
      setStatus({ ...status, predicting: false, deleting: false });
      setProgress(0);
    }
  };

  const getCurrentDisplayIDs = () => {
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

    const currentPatientUID = currentStudy?.series[0].PatientID;
    const currentSeriesInstanceUID = currentDisplaySet?.SeriesInstanceUID;
    const currentSOPInstanceUID = currentDisplaySet?.SOPInstanceUID;

    if (currentSeriesInstanceUID && currentSOPInstanceUID) {
      return {
        is_default_study: false,
        patient_id: currentPatientUID,
        study_id: currentStudyInstanceUID,
        series_id: currentSeriesInstanceUID,
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
        study_id: currentStudyInstanceUID,
        series_id: segmentationSeriesInstanceUID,
      };
    }

    return {
      is_default_study: true,
      patient_id: currentPatientUID,
      study_id: currentStudyInstanceUID,
      series_id: currentSeriesInstanceUID,
    };
  };

  const calculateDICEScore = async () => {
    let currentIDs;

    try {
      currentIDs = getCurrentDisplayIDs();
    } catch (error) {
      console.error(error);
      return;
    }

    if (currentIDs.is_default_study) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please load a segmentation.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    if (!selectedMaskIndex) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please set an active ground truth segmentaion.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const currentGroundTruth = availableMasks[selectedMaskIndex];

    const truthIDs = {
      patient_id: currentIDs.patient_id,
      study_id: currentIDs.patient_id,
      seriesInstanceUID: currentGroundTruth.seriesInstanceUID,
    };

    const activeIDs = {
      patient_id: currentIDs.patient_id,
      study_id: currentIDs.patient_id,
      seriesInstanceUID: currentIDs.series_id,
    };

    try {
      const response = await fetch(`${SURROGATE_HOST}/api/calculateDiceScore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentMask: JSON.stringify(activeIDs),
          groundTruth: JSON.stringify(truthIDs),
        }),
      });

      const body = await response.json();

      uiNotificationService.show({
        title: 'DICE Score Calculated',
        message: `Result of the calculation: ${body.diceScore}`,
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      return;
    }
  };

  const exportMask = async () => {
    const activeID = segmentationService.getActiveSegmentation()?.id;

    if (!activeID) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please load a segmentation',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    if (!extensionManager) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Could not reference the extension manager.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const datasources = extensionManager.getActiveDataSource();

    if (datasources.length === 0) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'There is no configured data source for exporting.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    let displaySetInstanceUIDs;

    try {
      displaySetInstanceUIDs = await createReportAsync({
        servicesManager,
        getReport: () =>
          commandsManager.runCommand('storeSegmentation', {
            segmentationId: activeID,
            dataSource: datasources[0],
          }),
        reportType: 'Segmentation',
      });
    } catch (error) {
      console.error(error);
      return;
    }

    if (!displaySetInstanceUIDs) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Could not load relavent data set information.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const viewportGridService = servicesManager.services.viewportGridService;

    segmentationService.remove(activeID);

    viewportGridService.setDisplaySetsForViewport({
      viewportId: viewportGridService.getActiveViewportId(),
      displaySetInstanceUIDs,
    });
  };

  const listModels = async () => {
    setStatus({ ...status, loadingModels: true });

    try {
      const response = await fetch(`${SURROGATE_HOST}/api/listModels`);
      const body = await response.json();

      setAvailableMasks(body.models);
      setSelectedModelIndex(undefined);
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, loadingModels: false });
    }
  };

  const listMasks = async () => {
    const { viewportGridService, displaySetService } = servicesManager.services;

    const activeViewportId = viewportGridService.getActiveViewportId();
    const activeDisplaySets = displaySetService.getActiveDisplaySets();

    const validDisplaySets = activeDisplaySets.filter(
      displaySet => displaySet.Modality === 'SEG' || displaySet.Modality === 'RTSTRUCT'
    );

    const displaySetSeries = validDisplaySets.map(displaySet => ({
      uid: displaySet.SeriesInstanceUID,
      description: displaySet.SeriesDescription,
    }));

    displaySetSeries.unshift({ uid: undefined, description: 'None' });

    setAvailableMasks(displaySetSeries);
  };

  React.useEffect(() => {
    listModels();
  }, []);

  React.useEffect(() => {
    listMasks();
  }, []);

  React.useEffect(() => {
    const socket = io(`${SURROGATE_HOST}`, { path: '/api/socket.io' });

    socket.on('progress_update', data => setProgress(data?.value || 0));

    socket.on('status_update', data => {
      if (!data?.message) return;

      uiNotificationService.show({
        title: 'Processing Update',
        message: data.message,
        type: 'loading',
        duration: 3000,
      });
    });

    socket.on('model_instances_update', () => listModels());

    return () => {
      setProgress(0);
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <Select
        className="w-full"
        closeMenuOnSelect={true}
        isSearchable={true}
        isClearable={false}
        options={availableModels.map((model, index) => ({ label: model.name, value: index }))}
        onChange={index => setSelectedModelIndex(index ? index : undefined)}
        value={selectedModelIndex}
        placeholder="Select a model."
      ></Select>

      <Select
        className="w-full"
        closeMenuOnSelect={true}
        isSearchable={true}
        isClearable={false}
        options={availableMasks.map((mask, index) => ({
          label: mask.description ? mask.description : mask.uid,
          value: index,
        }))}
        onChange={index => setSelectedMaskIndex(index ? index : undefined)}
        value={selectedMaskIndex}
        placeholder="Select a ground truth."
      ></Select>

      <ProgressLoadingBar progress={progress}></ProgressLoadingBar>

      <PanelSection title="Prediction Functions" className="w-full">
        <div className="flex flex-col items-center justify-center">
          <br />

          <Button
            onClick={() => runPrediction().catch(console.error)}
            children={status.predicting ? <MoonLoader size={16} color={'#eee'} /> : 'Predict'}
            disabled={!isPredictionAvailable()}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => console.log(getCurrentDisplayIDs())}
            children={'Get Instance ID'}
            disabled={isActive()}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => calculateDICEScore().catch(console.error)}
            children={status.uploading ? <MoonLoader size={16} color={'#eee'} /> : 'Calculate DICE'}
            disabled={isActive()}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => exportMask().catch(console.error)}
            children={status.uploading ? <MoonLoader size={16} color={'#eee'} /> : 'Export'}
            disabled={isActive()}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => listModels().catch(console.error)}
            children={
              status.loadingModels ? <MoonLoader size={16} color={'#eee'} /> : 'Refresh Models'
            }
            disabled={status.loadingModels}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => listMasks().catch(console.error)}
            children={
              status.loadingMasks ? (
                <MoonLoader size={16} color={'#eee'} />
              ) : (
                'Refresh Segmentations'
              )
            }
            disabled={isActive()}
            className="w-4/5"
          />
          <br />
        </div>
      </PanelSection>
    </div>
  );
};

export default PredictionPanel;
