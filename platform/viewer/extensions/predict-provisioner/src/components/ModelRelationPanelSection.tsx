import * as React from 'react';
import { PanelSection, Button } from '@ohif/ui';

import getActiveDisplayUIDSet from '../auxiliary/getActiveDisplayUIDSet';

import WrappedSelect from './WrappedSelect';

export default ({ status, setStatus, servicesManager }) => {
  const [availableModels, setAvailableModels] = React.useState([]);
  const [selectedModel, setSelectedModel] = React.useState({ value: undefined, label: undefined });

  const isProcessing = () => !Object.values(status).every(x => x === false);
  const isPredictionAvailable = () => selectedModel.value !== undefined && !isProcessing();

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
          selectedModel: availableModels[selectedModel.value]?.name,
          ...getActiveDisplayUIDSet(servicesManager),
        }),
      });

      if (response.ok || response.status === 202) {
        uiNotificationService.show({
          title: 'Prediction Queued',
          message: 'Prediction is running in the background. Please wait a few minutes...',
          type: 'success',
          duration: 5000,
        });
      }

      if (!response.ok) {
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

      setAvailableModels(body.models);
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, loading: false });
    }
  };

  React.useEffect(() => {
    getAvailableModels();
  }, []);

  return (
    <PanelSection title="Prediction Functions">
      <WrappedSelect
        label="Prediction Model"
        options={availableModels.map((model, index) => ({ value: index, label: model.name }))}
        value={selectedModel}
        onChange={selection => setSelectedModel(selection)}
      />

      <Button
        className="mb-2 mt-1"
        children="Predict"
        onClick={() => predict().catch(console.error)}
        disabled={!isPredictionAvailable}
      ></Button>
    </PanelSection>
  );
};
