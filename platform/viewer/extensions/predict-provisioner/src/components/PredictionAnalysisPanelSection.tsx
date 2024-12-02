import * as React from 'react';
import { PanelSection, Button, ProgressLoadingBar } from '@ohif/ui';

import getActiveDisplayUIDSet from './getActiveDisplayUIDSet';
import WrappedSelect, { WrappedSelectOption } from './WrappedSelect';
import { EvaluationMap, AnalysisPanelStatus } from './AnalysisPanel';

interface PredictionAnalysisPanelSectionProperties {
  status: AnalysisPanelStatus;
  setStatus: React.Dispatch<React.SetStateAction<AnalysisPanelStatus>>;
  evaluations: EvaluationMap;
  setEvaluations: React.Dispatch<React.SetStateAction<EvaluationMap>>;
  servicesManager: any;
}

type AvailableSegmentationMap = Map<string, WrappedSelectOption>;
export type SelectedSegmentationPair = [
  WrappedSelectOption | undefined,
  WrappedSelectOption | undefined,
];

export default (properties: PredictionAnalysisPanelSectionProperties) => {
  const { status, setStatus, evaluations, setEvaluations, servicesManager } = properties;
  const { uiNotificationService, displaySetService } = servicesManager.services;

  const [available, setAvailable] = React.useState<AvailableSegmentationMap>(new Map());
  const [selected, setSelected] = React.useState<SelectedSegmentationPair>([undefined, undefined]);
  const [progress, setProgress] = React.useState<number | undefined>(0);

  const isAnalysisAvailable = React.useMemo<boolean>(() => {
    return Boolean(selected[0]?.value && selected[1]?.value && !status.calculating);
  }, [selected, status]);

  const isAnalysisExportAvailable = React.useMemo<boolean>(() => {
    const sets = displaySetService.getActiveDisplaySets();

    const uids = [
      sets.find(set => set.SeriesInstanceUID === selected[0]?.value)?.displaySetInstanceUID,
      sets.find(set => set.SeriesInstanceUID === selected[1]?.value)?.displaySetInstanceUID,
    ];

    return Boolean(evaluations.get(`${uids[0]}:${uids[1]}`));
  }, [evaluations, selected]);

  React.useEffect(() => {
    status.calculating ? setProgress(undefined) : setProgress(0);
  }, [status]);

  const getAvailableSegmentations = () => {
    const active = displaySetService.getActiveDisplaySets();
    const valid = active.filter(set => set.Modality === 'SEG');

    const sets = valid.map(set => ({
      uid: set.SeriesInstanceUID,
      description: set.SeriesDescription,
    }));

    const updated = new Map();
    for (let series of sets) {
      const option = { label: series.description, value: series.uid };

      updated.set(series.uid, option);
    }

    setAvailable(updated);
  };

  const calculateDICEScore = async () => {
    const active = getActiveDisplayUIDSet({ servicesManager });

    if (!selected[0]?.value || !available.get(selected[0].value)) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a segmentaion to compare.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    if (!selected[1]?.value || !available.get(selected[1].value)) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a ground truth segmentaion to compare against.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    const shared = {
      patient_id: active.patient_id,
      study_id: active.patient_id,
      study_desc: active.study_description,
      study_uid: active.study_uid,
    };

    const pair = [
      {
        series_desc: selected[0].label,
        series_uid: selected[0].value,
        ...shared,
      },
      {
        series_desc: selected[1].label,
        series_uid: selected[1].value,
        ...shared,
      },
    ];

    setStatus({ ...status, calculating: true });

    const response = await fetch(`/api/getDICEScores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentDicomId: active.parent_id,
        currentMask: JSON.stringify(pair[0]),
        groundTruth: JSON.stringify(pair[1]),
      }),
    });

    const body = await response.json();

    const sets = displaySetService.getActiveDisplaySets();

    const uids = [
      sets.find(set => set.SeriesInstanceUID === pair[0].series_uid).displaySetInstanceUID,
      sets.find(set => set.SeriesInstanceUID === pair[1].series_uid).displaySetInstanceUID,
    ];

    const updated = new Map(evaluations);
    updated.set(uids.join(':'), {
      descriptors: [
        { label: pair[0].series_desc, value: uids[0] },
        { label: pair[1].series_desc, value: uids[1] },
      ],
      result: body,
    });

    setEvaluations(updated);
    setStatus({ ...status, calculating: false });

    uiNotificationService.show({
      title: 'Complete',
      message: `Analysis was a success.`,
      type: 'success',
      duration: 5000,
    });
  };

  const saveDiscrepancy = async () => {
    const active = getActiveDisplayUIDSet({ servicesManager });

    if (!selected[0]?.value || !available.get(selected[0].value)) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a segmentaion to compare.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    if (!selected[1]?.value || !available.get(selected[1].value)) {
      uiNotificationService.show({
        title: 'Unable to Process',
        message: 'Please select a ground truth segmentaion to compare against.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    const shared = {
      patient_id: active.patient_id,
      study_id: active.patient_id,
      study_desc: active.study_description,
      study_uid: active.study_uid,
    };

    const pair = [
      {
        series_desc: selected[0].label,
        series_uid: selected[0].value,
        ...shared,
      },
      {
        series_desc: selected[1].label,
        series_uid: selected[1].value,
        ...shared,
      },
    ];

    setStatus({ ...status, calculating: true });

    const response = await fetch(`/api/saveDiscrepancyMask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_id: active.parent_id,
        predSeriesUid: JSON.stringify(pair[0]),
        truthSeriesUid: JSON.stringify(pair[1]),
      }),
    });

    if (response.ok || response.status === 202) {
      uiNotificationService.show({
        title: 'Discrepancy Processing',
        message: 'Creating Discrepancy mask in the background. Please wait a few minutes...',
        type: 'success',
        duration: 5000,
      });
    } else {
      const json = await response.json();

      uiNotificationService.show({
        title: 'Discrepancy Error',
        message: json.message || 'Something went wrong with the discrepancy calculation.',
        type: 'error',
        duration: 5000,
      });
    }

    setStatus({ ...status, calculating: false });
  };

  const saveToFile = (name: string, data: string) => {
    const file = new Blob([data], { type: 'text/plain' });
    const element = document.createElement('a');
    const url = URL.createObjectURL(file);

    element.href = URL.createObjectURL(file);
    element.download = name;
    document.body.appendChild(element);
    element.click();

    setTimeout(() => {
      document.body.removeChild(element);
      window.URL.revokeObjectURL(url);
    }, 0);
  };

  const saveToCSV = async () => {
    const sets = displaySetService.getActiveDisplaySets();

    const uids = [
      sets.find(set => set.SeriesInstanceUID === selected[0]?.value)?.displaySetInstanceUID,
      sets.find(set => set.SeriesInstanceUID === selected[1]?.value)?.displaySetInstanceUID,
    ];

    const evaluation = evaluations.get(`${uids[0]}:${uids[1]}`);

    if (!evaluation) {
      uiNotificationService.show({
        title: 'Unable to Export',
        message: 'Please calculate an analysis between the selected segmentations.',
        type: 'error',
        duration: 5000,
      });

      return;
    }

    let data = 'label,value\n';
    for (let entry of evaluation.result) data += `${entry.label},${entry.value}\n`;

    const scrubbed = [
      evaluation.descriptors[0].label.replace(/[^a-z0-9]/gi, '-'),
      evaluation.descriptors[1].label.replace(/[^a-z0-9]/gi, '-'),
    ];

    saveToFile(`${scrubbed[0]}_${scrubbed[1]}.csv`, data);
  };

  React.useEffect(() => {
    const handle = () => getAvailableSegmentations();

    displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_ADDED, handle);

    return () => displaySetService.unsubscribe(displaySetService.EVENTS.DISPLAY_SETS_ADDED, handle);
  }, [servicesManager]);

  return (
    <PanelSection title="Analysis Tools">
      <div className="mb-2">
        <ProgressLoadingBar progress={progress} />
      </div>

      <WrappedSelect
        description="Predicted Segmentation"
        options={Array.from(available.values())}
        value={selected[0]}
        onChange={option => {
          setSelected(previous => {
            previous[0] = option;
            return [...previous];
          });
        }}
      />

      <WrappedSelect
        description="Ground Truth Segmentation"
        options={Array.from(available.values())}
        value={selected[1]}
        onChange={option => {
          setSelected(previous => {
            previous[1] = option;
            return [...previous];
          });
        }}
      />

      <Button
        className="mb-1 mt-1"
        children="Calculate DICE Score"
        onClick={() => calculateDICEScore().catch(console.error)}
        disabled={!isAnalysisAvailable}
      />

      <Button
        className="mb-1 mt-1"
        children="Save Discrepancy"
        onClick={() => saveDiscrepancy().catch(console.error)}
        disabled={!isAnalysisAvailable}
      />

      <Button
        className="mb-1 mt-1"
        children="Export CSV"
        onClick={() => saveToCSV().catch(console.error)}
        disabled={!isAnalysisExportAvailable}
      />
    </PanelSection>
  );
};
