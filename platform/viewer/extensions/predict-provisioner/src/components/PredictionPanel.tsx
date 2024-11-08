import * as React from 'react';

import { Button, PanelSection, ProgressLoadingBar, Select, Label, Typography } from '@ohif/ui';

import { createReportAsync } from '@ohif/extension-default';
import { DicomMetadataStore } from '@ohif/core';
import CornerstoneSEG from '@ohif/extension-cornerstone-dicom-seg';

const SURROGATE_HOST = '';

const PredictionPanel = ({ servicesManager, commandsManager, extensionManager }) => {
  const { segmentationService, uiNotificationService } = servicesManager.services;

  const [progress, setProgress] = React.useState<number | undefined>(undefined);

  const [availableModels, setAvailableModels] = React.useState<any[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | undefined>(undefined);
  const [selectedModelLabel, setSelectedModelLabel] = React.useState<string | undefined>(undefined);

  const [availableMasks, setAvailableMasks] = React.useState<any[]>([]);
  const [selectedMaskIndex, setSelectedMaskIndex] = React.useState<number | undefined>(undefined);
  const [selectedMaskLabel, setSelectedMaskLabel] = React.useState<string | undefined>(undefined);

  const [status, setStatus] = React.useState<{ [key: string]: boolean }>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loadingModels: false,
    loadingMasks: false,
  });

  const [segmentations, setSegmentations] = React.useState<any[]>([]);

  const isActive = () => !Object.values(status).every(x => x === false);
  const isPredictionAvailable = () => selectedModelIndex !== undefined && !isActive();
  const isDICECalculationAvailable = () =>
    selectedMaskIndex !== undefined && !isActive() && segmentations.length > 0;

  const runPrediction = async () => {
    if (selectedModelIndex === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a model.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    setStatus({ ...status, predicting: true });

    try {
      const currentScreenIDs = getCurrentDisplayIDs();

      if (currentScreenIDs.is_default_study === false) {
        uiNotificationService.show({
          title: 'Cannot Run Predictions on a Segmentation',
          message: 'Please select a CT scan and try again.',
          type: 'error',
          duration: 3000,
        });

        return;
      }

    const runResponse = await fetch(`${SURROGATE_HOST}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedModel: availableModels[selectedModelIndex]?.name,
          ...currentScreenIDs,
        }),
      });
    if(!runResponse.ok) {
        const responseJson = await runResponse.json();
        uiNotificationService.show({
            title: 'Prediction error',
            message: responseJson.message || 'Something went wrong with the prediction.',
            type: 'error',
            duration: 5000,
        });
    }
    } catch (error) {
      console.error(error);
      uiNotificationService.show({
        title: 'Prediction error',
        message: error.message || 'Something went wrong with the prediction.',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setStatus({ ...status, predicting: false, deleting: false });
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
    const currentStudyDescription = currentStudy?.StudyDescription;
    const currentPatientUID = currentStudy?.series[0].PatientID;
    const currentStudyID = currentStudy?.series[0].StudyID;
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
        parent_id: currentSeriesInstanceUID,
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

  const getCurrentImageMetadata = () => {
    if (DicomMetadataStore === undefined) {
      uiNotificationService.show({
        title: 'Unable to Fetch Metadata',
        message: 'DicomMetadataStore service is not available.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const currentScreenIDs = getCurrentDisplayIDs();

    if (currentScreenIDs === undefined) {
      uiNotificationService.show({
        title: 'Unable to Access Screen',
        message: 'No active viewport found.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const firstImageMetadata = DicomMetadataStore.getSeries(
      currentScreenIDs.study_uid,
      currentScreenIDs.series_id
    ).instances[0];

    const metadata = Object.keys(firstImageMetadata).reduce((acc, key) => {
      acc[key] = firstImageMetadata[key];

      return acc;
    }, {});

    return metadata;
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

    if (selectedMaskIndex === undefined || availableMasks[selectedMaskIndex].uid === undefined) {
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
      study_desc: currentIDs.study_description,
      study_uid: currentIDs.study_uid,
      seriesInstanceUID: currentGroundTruth.uid,
    };

    const activeIDs = {
      patient_id: currentIDs.patient_id,
      study_id: currentIDs.patient_id,
      study_desc: currentIDs.study_description,
      study_uid: currentIDs.study_uid,
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

    if (activeID === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please load a segmentation',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    if (extensionManager === undefined) {
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

    if (displaySetInstanceUIDs === undefined) {
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

      setAvailableModels(body.models);
      setSelectedModelIndex(undefined);
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, loadingModels: false });
    }
  };

  const listMasks = () => {
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

  const spliceSegmentLabels = proxiedSegmentations => {
    setSegmentations(proxiedSegmentations);

    return proxiedSegmentations;
  };

  const segmentationServiceProxyHandler = {
    get(target, property) {
      const value = Reflect.get(target, property);

      if (typeof value === 'function' && property === 'getSegmentations') {
        const segmentations = value.bind(target)();

        return () => spliceSegmentLabels(segmentations);
      } else if (typeof value === 'function') return value.bind(target);

      return value;
    },
  };

  const segmentationServiceProxy = new Proxy(segmentationService, segmentationServiceProxyHandler);

  const servicesProxyHandler = {
    get(target, property) {
      const value = Reflect.get(target, property);

      if (typeof value === 'function') return value.bind(target);
      if (property === 'segmentationService') return segmentationServiceProxy;

      return value;
    },
  };

  const servicesProxy = new Proxy(servicesManager.services, servicesProxyHandler);

  const PanelSegmentationWithTools = CornerstoneSEG.getPanelModule({
    servicesManager: { services: servicesProxy },
    commandsManager,
    extensionManager,
  })[1].component();

  const ModelSelect = (
    <Select
      className="mb-2 w-full"
      closeMenuOnSelect={true}
      isSearchable={true}
      isClearable={false}
      options={availableModels.map((model, index) => ({
        value: index,
        label: model.name,
      }))}
      onChange={selection => {
        setSelectedModelIndex(selection.value);
        setSelectedModelLabel(selection.label);
      }}
      value={
        selectedModelIndex === undefined && selectedModelLabel === undefined
          ? undefined
          : { value: selectedModelIndex, label: selectedModelLabel }
      }
    />
  );

  const ModelText = (
    <Typography
      color="primaryLight"
      children="Prediction Model"
      className="mb-0.5"
      varient="subtitle"
    />
  );

  const MaskSelect = (
    <Select
      className="mb-2 w-full"
      closeMenuOnSelect={true}
      isSearchable={true}
      isClearable={false}
      options={availableMasks.map((mask, index) => ({
        value: index,
        label: mask.description ? mask.description : mask.uid,
      }))}
      onChange={selection => {
        setSelectedMaskIndex(selection.value);
        setSelectedMaskLabel(selection.label);
      }}
      value={
        selectedMaskIndex === undefined && selectedMaskLabel === undefined
          ? undefined
          : { value: selectedMaskIndex, label: selectedMaskLabel }
      }
    />
  );

  const MaskText = (
    <Typography
      color="primaryLight"
      children="Ground Truth"
      className="mb-0.5"
      varient="subtitle"
    />
  );

  React.useEffect(() => {
    listModels();
  }, []);

  React.useEffect(() => {
    const { displaySetService } = servicesManager.services;

    if (displaySetService === undefined) {
      uiNotificationService.show({
        title: 'Unable to Load',
        message: 'Could not load the stored segmentations information.',
        type: 'error',
        duration: 3000,
      });

      return;
    }

    const handleDisplaySetsAdded = () => listMasks();

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

  React.useEffect(() => {
    isActive() ? setProgress(undefined) : setProgress(0);
  }, [status]);

  React.useEffect(() => {
    console.log('DEBUG:', segmentations);
  }, [segmentations]);

  return (
    <div>
      <Label children={ModelSelect} text={ModelText} />
      <Label children={MaskSelect} text={MaskText} />

      <ProgressLoadingBar progress={progress}></ProgressLoadingBar>

      <PanelSection title="Prediction Functions">
        <div className="flex flex-col items-center justify-center">
          <br />

          <Button
            onClick={() => runPrediction().catch(console.error)}
            children={'Predict'}
            disabled={!isPredictionAvailable()}
            className="w-4/5"
          />
          <br />

          <Button
            onClick={() => calculateDICEScore().catch(console.error)}
            children={'Calculate DICE'}
            disabled={!isDICECalculationAvailable()}
            className="w-4/5"
          />
          <br />
        </div>
      </PanelSection>

      {PanelSegmentationWithTools}
    </div>
  );
};

export default PredictionPanel;
