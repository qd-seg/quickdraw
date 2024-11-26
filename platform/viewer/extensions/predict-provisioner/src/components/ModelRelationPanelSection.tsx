import * as React from 'react';
import { Socket } from 'socket.io-client';
import { PanelSection, Button, ProgressLoadingBar } from '@ohif/ui';

import getActiveDisplayUIDSet from './getActiveDisplayUIDSet';
import WrappedSelect, { WrappedSelectOption } from './WrappedSelect';
import { AnalysisPanelStatus } from './AnalysisPanel';

interface ModelRelationPanelSectionProperties {
  socket?: Socket;
  status: AnalysisPanelStatus;
  setStatus: React.Dispatch<React.SetStateAction<AnalysisPanelStatus>>;
  servicesManager: any;
}

type AvailableModelMap = Map<string, AvailableModelOption>;
interface AvailableModelOption extends WrappedSelectOption {
  running: boolean;
  updateTime: Date;
}

export default (properties: ModelRelationPanelSectionProperties) => {
  const { status, setStatus, servicesManager, socket } = properties;
  const { uiNotificationService } = servicesManager.services;

  const [progress, setProgress] = React.useState<number | undefined>(0);
  const [available, setAvailable] = React.useState<AvailableModelMap>(new Map());
  const [selected, setSelected] = React.useState<WrappedSelectOption | undefined>(undefined);

  const isPredictionInProgress = React.useMemo(
    () => status.predicting || !Array.from(available.values()).every(model => !model.running),
    [status, available]
  );

  const predict = async () => {
    if (selected?.value === undefined) {
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
          selectedModel: selected.value,
          ...getActiveDisplayUIDSet({ servicesManager }),
        }),
      });

      if (response.ok === true) return;

      const json = await response.json();

      uiNotificationService.show({
        title: 'Prediction Error',
        message: json.message || 'Something went wrong with the prediction.',
        type: 'error',
        duration: 5000,
      });
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

      const updated = new Map();
      for (let model of body.models) {
        updated.set(model.name, {
          label: `${model.running ? '[Running]' : ''} ${model.name}`,
          value: model.name,
          running: model.running,
          updateTime: new Date(model.pdateTime),
        });
      }
      setAvailable(updated);

      if (selected?.value === undefined) return;

      const previous = updated.get(selected.value);

      setSelected({
        value: previous.value,
        label: `${previous.running ? '[Running]' : ''} ${previous.value}`,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setStatus({ ...status, loading: false });
    }
  };

  const setPredictionProgress = ({ value }) => {
    setProgress(isPredictionInProgress ? parseFloat(value) || undefined : 0);
  };

  React.useEffect(() => {
    getAvailableModels();
  }, []);

  React.useEffect(() => {
    if (socket === undefined) return;

    socket.on('prediction_progress_update', setPredictionProgress);

    return () => {
      socket.off('prediction_progress_update', setPredictionProgress);
    };
  }, [available]);

  React.useEffect(() => {
    if (socket === undefined) return;

    socket.on('update_model_list', getAvailableModels);

    return () => {
      socket.off('update_model_list', getAvailableModels);
    };
  }, [selected]);

  React.useEffect(() => {
    if (progress === 100) setProgress(0);
  }, [progress]);

  return (
    <PanelSection title="Prediction Functions">
      <div className="mb-2">
        <ProgressLoadingBar progress={progress} />
      </div>

      <WrappedSelect
        description="Prediction Model"
        options={Array.from(available.values())}
        value={selected}
        onChange={setSelected}
      />

      <Button
        className="mb-2 mt-1"
        children="Predict"
        onClick={() => predict().catch(console.error)}
        disabled={isPredictionInProgress}
      />
    </PanelSection>
  );
};
