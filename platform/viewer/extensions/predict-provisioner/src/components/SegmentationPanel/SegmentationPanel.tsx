import * as React from 'react';
import { createReportAsync } from '@ohif/extension-default';
import { useAppConfig } from '@state';

import callInputDialog from './callInputDialog';
import callColorPickerDialog from './callColorPickerDialog';
import { Segmentation, SegmentationConfiguration } from './SegmentationServiceTypes';

import SegmentationGroupTable from '../SegmentationGroupTable';
import { EvaluationMap } from '../AnalysisPanel';

interface SegmentationPanelProperties {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
  evaluations: EvaluationMap;
}

type GridViewportSubscriptions = { grid: (() => unknown)[]; data: (() => unknown)[] };

export default (properties: SegmentationPanelProperties) => {
  const { servicesManager, commandsManager, extensionManager, evaluations } = properties;
  const {
    segmentationService,
    customizationService,
    viewportGridService,
    uiDialogService,
    displaySetService,
    cornerstoneViewportService,
  } = servicesManager.services;

  const configuration = {
    disableEditing: useAppConfig()[0].disableEditing,
    ...customizationService.get('segmentation.panel'),
  };

  const [additionalClassName, setAdditionalClassName] = React.useState<string>('');
  const [segmentations, setSegmentations] = React.useState<Segmentation[]>(() =>
    segmentationService.getSegmentations()
  );
  const [segmentationConfiguration, setSegmentationConfiguration] =
    React.useState<SegmentationConfiguration>(() => segmentationService.getConfiguration());

  const setSegmentationConfigurationWrapper = React.useCallback(
    (segmentationId, key, value) => {
      segmentationService.setConfiguration({
        segmentationId,
        [key]: value,
      });
    },
    [segmentationService]
  );

  const getToolGroupIds = segmentationId => {
    return segmentationService.getToolGroupIdsWithSegmentation(segmentationId);
  };

  const onSegmentationAdd = async () => {
    commandsManager.runCommand('createEmptySegmentationForViewport', {
      viewportId: viewportGridService.getActiveViewportId(),
    });
  };

  const onSegmentationAddWrapper =
    configuration.onSegmentationAdd && typeof configuration.onSegmentationAdd === 'function'
      ? configuration.onSegmentationAdd
      : onSegmentationAdd;

  const onSegmentationDelete = segmentationId => {
    segmentationService.remove(segmentationId);
  };

  const onSegmentationEdit = segmentationId => {
    const segmentation = segmentationService.getSegmentation(segmentationId);
    const { label } = segmentation;

    callInputDialog(uiDialogService, label, label => {
      if (label === '') return;

      segmentationService.addOrUpdateSegmentation({ id: segmentationId, label }, false, true);
    });
  };

  const onSegmentationClick = segmentationId => {
    segmentationService.setActiveSegmentationForToolGroup(segmentationId);
  };

  const onSegmentationToggleVisibility = segmentationId => {
    segmentationService.toggleSegmentationVisibility(segmentationId);

    const segmentation = segmentationService.getSegmentation(segmentationId);

    const isVisible = segmentation.isVisible;
    const segments = segmentation.segments;

    getToolGroupIds(segmentationId).forEach(toolGroupId => {
      segments.forEach((_, segmentIndex) => {
        segmentationService.setSegmentVisibility(
          segmentationId,
          segmentIndex,
          isVisible,
          toolGroupId
        );
      });
    });
  };

  const onSegmentationDownload = segmentationId => {
    commandsManager.runCommand('downloadSegmentation', { segmentationId });
  };

  const onSegmentationDownloadRTSS = segmentationId => {
    commandsManager.runCommand('downloadRTSS', { segmentationId });
  };

  const onSegmentationExport = async segmentationId => {
    const datasources = extensionManager.getActiveDataSource();

    const displaySetInstanceUIDs = await createReportAsync({
      servicesManager,
      getReport: () =>
        commandsManager.runCommand('storeSegmentation', {
          segmentationId,
          dataSource: datasources[0],
        }),
      reportType: 'Segmentation',
    });

    if (displaySetInstanceUIDs) {
      segmentationService.remove(segmentationId);

      viewportGridService.setDisplaySetsForViewport({
        viewportId: viewportGridService.getActiveViewportId(),
        displaySetInstanceUIDs,
      });
    }
  };

  const onSegmentAdd = segmentationId => {
    segmentationService.addSegment(segmentationId);
  };

  const onSegmentDelete = (segmentationId, segmentIndex) => {
    segmentationService.removeSegment(segmentationId, segmentIndex);
  };

  const onSegmentEdit = (segmentationId, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationId);

    const segment = segmentation.segments[segmentIndex];
    const { label } = segment;

    callInputDialog(uiDialogService, label, label => {
      if (label === '') return;

      segmentationService.setSegmentLabel(segmentationId, segmentIndex, label);
    });
  };

  const onSegmentClick = (segmentationId, segmentIndex) => {
    segmentationService.setActiveSegment(segmentationId, segmentIndex);

    getToolGroupIds(segmentationId).forEach(toolGroupId => {
      segmentationService.setActiveSegmentationForToolGroup(segmentationId, toolGroupId);
      segmentationService.jumpToSegmentCenter(segmentationId, segmentIndex, toolGroupId);
    });
  };

  const onSegmentColorClick = (segmentationId, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationId);

    const segment = segmentation.segments[segmentIndex];
    const { color, opacity } = segment;

    const rgbaColor = {
      r: color[0],
      g: color[1],
      b: color[2],
      a: opacity / 255.0,
    };

    callColorPickerDialog(uiDialogService, rgbaColor, (newRGBAColor, actionId) => {
      if (actionId === 'cancel') return;

      segmentationService.setSegmentRGBAColor(segmentationId, segmentIndex, [
        newRGBAColor.r,
        newRGBAColor.g,
        newRGBAColor.b,
        newRGBAColor.a * 255.0,
      ]);
    });
  };

  const onSegmentToggleVisibility = (segmentationId, segmentIndex) => {
    const segmentation = segmentationService.getSegmentation(segmentationId);
    const segment = segmentation.segments[segmentIndex];
    const isVisible = !segment.isVisible;

    getToolGroupIds(segmentationId).forEach(toolGroupId => {
      segmentationService.setSegmentVisibility(
        segmentationId,
        segmentIndex,
        isVisible,
        toolGroupId
      );
    });
  };

  const onSegmentToggleLock = (segmentationId, segmentIndex) => {
    segmentationService.toggleSegmentLocked(segmentationId, segmentIndex);
  };

  const setRenderOutline = value => {
    setSegmentationConfigurationWrapper(undefined, 'renderOutline', value);
  };

  const setRenderFill = value => {
    setSegmentationConfigurationWrapper(undefined, 'renderFill', value);
  };

  const setRenderInactiveSegmentations = value => {
    setSegmentationConfigurationWrapper(undefined, 'renderInactiveSegmentations', value);
  };

  const setOutlineOpacityActive = value => {
    setSegmentationConfigurationWrapper(undefined, 'outlineOpacity', value);
  };

  const setOutlineWidthActive = value => {
    setSegmentationConfigurationWrapper(undefined, 'outlineWidthActive', value);
  };

  const setFillAlpha = value => {
    setSegmentationConfigurationWrapper(undefined, 'fillAlpha', value);
  };

  const setFillAlphaInactive = value => {
    setSegmentationConfigurationWrapper(undefined, 'fillAlphaInactive', value);
  };

  React.useEffect(() => {
    const added = segmentationService.EVENTS.SEGMENTATION_ADDED;
    const updated = segmentationService.EVENTS.SEGMENTATION_UPDATED;
    const removed = segmentationService.EVENTS.SEGMENTATION_REMOVED;

    const subscriptions: (() => unknown)[] = [];

    [added, updated, removed].forEach(event => {
      const { unsubscribe } = segmentationService.subscribe(event, () => {
        const segmentations = segmentationService.getSegmentations();

        setSegmentations(segmentations);
        setSegmentationConfiguration(segmentationService.getConfiguration());
      });

      subscriptions.push(unsubscribe);
    });

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  React.useEffect(() => {
    const handleActiveViewportChange = (viewportId: string | undefined) => {
      const activeViewportId = viewportId || viewportGridService.getActiveViewportId();
      const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);

      if (!displaySetUIDs) return;

      const isReconstructable =
        displaySetUIDs?.some(displaySetUID => {
          const displaySet = displaySetService.getDisplaySetByUID(displaySetUID);

          return displaySet?.isReconstructable;
        }) || false;

      if (isReconstructable) {
        setAdditionalClassName('');
      } else {
        setAdditionalClassName('ohif-disabled');
      }
    };

    handleActiveViewportChange(undefined);

    const changed = viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED;
    const ready = viewportGridService.EVENTS.VIEWPORTS_READY;
    const modified = cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED;

    const subscriptions: GridViewportSubscriptions = { grid: [], data: [] };

    [modified].forEach(event => {
      const { unsubscribe } = cornerstoneViewportService.subscribe(event, () => {
        handleActiveViewportChange(undefined);
      });

      subscriptions.data.push(unsubscribe);
    });

    [changed, ready].forEach(event => {
      const { unsubscribe } = viewportGridService.subscribe(event, ({ viewportId }) => {
        handleActiveViewportChange(viewportId);
      });

      subscriptions.grid.push(unsubscribe);
    });

    return () => {
      subscriptions.grid.forEach(unsubscribe => unsubscribe());
      subscriptions.data.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return (
    <SegmentationGroupTable
      configuration={{ initialConfiguration: segmentationConfiguration }}
      evaluations={evaluations}
      segmentations={segmentations}
      additionalClassName={additionalClassName}
      disableEditing={configuration.disableEditing || false}
      showAddSegmentation={true}
      showAddSegment={configuration.addSegment || false}
      showDeleteSegment={true}
      onSegmentationAdd={onSegmentationAddWrapper}
      onSegmentationDelete={onSegmentationDelete}
      onSegmentationEdit={onSegmentationEdit}
      onSegmentationClick={onSegmentationClick}
      onSegmentationToggleVisibility={onSegmentationToggleVisibility}
      onSegmentationDownload={onSegmentationDownload}
      onSegmentationDownloadRTSS={onSegmentationDownloadRTSS}
      onSegmentationExport={onSegmentationExport}
      onSegmentAdd={onSegmentAdd}
      onSegmentDelete={onSegmentDelete}
      onSegmentEdit={onSegmentEdit}
      onSegmentClick={onSegmentClick}
      onSegmentColorClick={onSegmentColorClick}
      onSegmentToggleVisibility={onSegmentToggleVisibility}
      onSegmentToggleLock={onSegmentToggleLock}
      setRenderOutline={setRenderOutline}
      setRenderFill={setRenderFill}
      setRenderInactiveSegmentations={setRenderInactiveSegmentations}
      setOutlineOpacityActive={setOutlineOpacityActive}
      setOutlineWidthActive={setOutlineWidthActive}
      setFillAlpha={setFillAlpha}
      setFillAlphaInactive={setFillAlphaInactive}
    />
  );
};
