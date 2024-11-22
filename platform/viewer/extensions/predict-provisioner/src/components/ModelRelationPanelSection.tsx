import * as React from 'react';
import { PanelSection, Button, ProgressLoadingBar } from '@ohif/ui';

import getActiveDisplayUIDSet from './getActiveDisplayUIDSet';
import WrappedSelect from './WrappedSelect';
import { Socket } from 'socket.io-client';
import { PanelStatus } from './AnalysisPanel';

interface ModelRelationPanelSectionProps {
    status: PanelStatus;
    setStatus: React.Dispatch<React.SetStateAction<PanelStatus>>;
    servicesManager: any;
    socket?: Socket;
};

export default ({ status, setStatus, servicesManager, socket }: ModelRelationPanelSectionProps) => {
  const [availableModels, setAvailableModels] = React.useState<Record<string, any>>({});
  const [selectedModel, setSelectedModel] = React.useState<{
    value: string | undefined;
    label: string | undefined;
  }>({
    value: undefined,
    label: undefined,
  });

  const [progress, setProgress] = React.useState<number | undefined>(0);

  const isProcessing = () => !Object.values(status).every(x => x === false);
  const isPredictionAvailable = () => selectedModel.value !== undefined && isProcessing() === false;
//   const isPredictionInProgress = () => Object.values(availableModels).every(model => !model.running)
  const isPredictionInProgress = React.useMemo(() => {
    return status.predicting || !Object.values(availableModels).every(model => !model.running);
  }, [status, availableModels]);

  const predict = async () => {
    const { uiNotificationService } = servicesManager.services;

    if (selectedModel.value === undefined) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a model.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    setStatus({ ...status, predicting: true });

    try {
      const response = await fetch(`/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedModel: selectedModel.value,
          ...getActiveDisplayUIDSet({ servicesManager }),
        }),
      });

      if (response.ok === false) {
        const json = await response.json();

        uiNotificationService.show({
          title: 'Prediction Error',
          message: json.message || 'Something went wrong with the prediction.',
          type: 'error',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error(error);

      uiNotificationService.show({
        title: 'Prediction Error',
        message: error.message || 'Something went wrong with the prediction.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setStatus({ ...status, predicting: false });
    }
  };

  const getAvailableModels = async () => {
    setStatus({ ...status, loading: true });

    try {
      const response = await fetch(`/api/listModels`);
      const body = await response.json();

      const models = {};
      for (let model of body.models) models[model.name] = model;
      if (selectedModel.value !== undefined) {
        const prevModel = models[selectedModel.value];
        setSelectedModel({
            value: prevModel.name,
            label: prevModel.name + (prevModel.running ? ' (running)' : '')
        });
      }
      setAvailableModels(models);
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, loading: false });
    }
  };

  React.useEffect(() => {
    getAvailableModels();
  }, []);

  React.useEffect(() => {
    if (socket === undefined) return;

    function setPredictionProgress({ value }) {
        setProgress(isPredictionInProgress ? (parseFloat(value) || undefined) : 0);
    };

    socket.on('prediction_progress_update', setPredictionProgress);
    return () => {
        socket.off('prediction_progress_update', setPredictionProgress);
    };
  }, [availableModels]);

  React.useEffect(() => {
    if (socket === undefined) return;

    async function getAndSetAvailableModels() {
        getAvailableModels();
    };

    socket.on('update_model_list', getAndSetAvailableModels);
    return () => {
        socket.off('update_model_list', getAndSetAvailableModels);
    };
  }, [selectedModel]);

  React.useEffect(() => {
    if (progress === 100) {
        setProgress(0);
    }
  }, [progress]);

  return (
    <PanelSection title="Prediction Functions">
      <WrappedSelect
        label="Prediction Model"
        // options={Object.keys(availableModels).map(name => ({ value: name, label: name }))}
        options={Object.entries(availableModels).map(([modelName, model]) => 
            ({ value: modelName, label: modelName + (model.running ? ' (running)' : '')})
        )}
        value={selectedModel} // should prob get label from selectedModel. needs to update on change
        // value={selectedModel.label === undefined ? selectedModel : {...selectedModel, label: selectedModel.label + (availableModels[selectedModel.value || '']?.running ? ' (running)' : '')}}
        onChange={selection => {setSelectedModel(selection)}}
      />

      <ProgressLoadingBar className="" progress={progress} />
      <Button
        className="mb-2 mt-1"
        children="Predict"
        onClick={() => predict().catch(console.error)}
        disabled={isPredictionAvailable() === false}
      ></Button>
    </PanelSection>
  );
};
