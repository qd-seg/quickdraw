import * as React from 'react';
import { createReportAsync } from '@ohif/extension-default';
import { useViewportGrid } from '@ohif/ui';
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
    uiNotificationService,
    displaySetService,
    hangingProtocolService,
    cornerstoneViewportService,
  } = servicesManager.services;

  const [{ isHangingProtocolLayout }] = useViewportGrid();

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
    (id, key, value) => {
      segmentationService.setConfiguration({
        segmentationId: id,
        [key]: value,
      });
    },
    [segmentationService]
  );

  const getToolGroupIdentifiers = id => {
    return segmentationService.getToolGroupIdsWithSegmentation(id);
  };

  const onSegmentationOpen = id => {
    if (!id) {
      uiNotificationService.show({
        title: 'Unable to Open Segmentation',
        message: 'The segmentation identifier was not provided.',
        type: 'info',
        duration: 3000,
      });
    }

    if (segmentations.find(segmentation => segmentation.id === id)) {
      uiNotificationService.show({
        title: 'Unable to Open Segmentation',
        message: 'The segmentation is already loaded.',
        type: 'info',
        duration: 3000,
      });
    }

    const sets = displaySetService.getActiveDisplaySets();

    if (!sets.find(set => set.displaySetInstanceUID === id)) {
      uiNotificationService.show({
        title: 'Unable to Open Segmentation',
        message: 'Could not load the correct display set.',
        type: 'info',
        duration: 3000,
      });
    }

    let viewports = [];

    try {
      viewports = hangingProtocolService.getViewportsRequireUpdate(
        viewportGridService.getActiveViewportId(),
        id,
        isHangingProtocolLayout
      );
    } catch (error) {
      console.warn(error);

      uiNotificationService.show({
        title: 'Open Segmentation',
        message: 'The selected display sets could not be added to the viewport.',
        type: 'info',
        duration: 3000,
      });
    }

    viewportGridService.setDisplaySetsForViewports(viewports);
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

  const onSegmentationDelete = id => {
    segmentationService.remove(id);
  };

  const onSegmentationEdit = id => {
    const segmentation = segmentationService.getSegmentation(id);
    const { label } = segmentation;

    callInputDialog(uiDialogService, label, label => {
      if (label === '') return;

      segmentationService.addOrUpdateSegmentation({ id, label }, false, true);
    });
  };

  const onSegmentationClick = id => {
    segmentationService.setActiveSegmentationForToolGroup(id);
  };

  const onSegmentationToggleVisibility = id => {
    segmentationService.toggleSegmentationVisibility(id);
    const segmentation = segmentationService.getSegmentation(id);
    const segments = segmentation.segments;

    getToolGroupIdentifiers(id).forEach(group => {
      segments.forEach((_, index) => {
        segmentationService.setSegmentVisibility(id, index, segmentation.isVisible, group);
      });
    });
  };

  const onSegmentationDownload = id => {
    commandsManager.runCommand('downloadSegmentation', { segmentationId: id });
  };

  const onSegmentationDownloadRTSS = id => {
    commandsManager.runCommand('downloadRTSS', { segmentationId: id });
  };

  const onSegmentationExport = async id => {
    const datasources = extensionManager.getActiveDataSource();

    const displaySetInstanceUIDs = await createReportAsync({
      servicesManager,
      getReport: () =>
        commandsManager.runCommand('storeSegmentation', {
          segmentationId: id,
          dataSource: datasources[0],
        }),
      reportType: 'Segmentation',
    });

    if (displaySetInstanceUIDs) {
      segmentationService.remove(id);

      viewportGridService.setDisplaySetsForViewport({
        viewportId: viewportGridService.getActiveViewportId(),
        displaySetInstanceUIDs,
      });
    }
  };

  const onSegmentAdd = id => {
    segmentationService.addSegment(id);
  };

  const onSegmentDelete = (id, index) => {
    segmentationService.removeSegment(id, index);
  };

  const onSegmentEdit = (id, index) => {
    const segmentation = segmentationService.getSegmentation(id);

    const segment = segmentation.segments[index];
    const { label } = segment;

    callInputDialog(uiDialogService, label, label => {
      if (label === '') return;

      segmentationService.setSegmentLabel(id, index, label);
    });
  };

  const onSegmentClick = (id, index) => {
    segmentationService.setActiveSegment(id, index);

    getToolGroupIdentifiers(id).forEach(group => {
      segmentationService.setActiveSegmentationForToolGroup(id, group);
      segmentationService.jumpToSegmentCenter(id, index, group);
    });
  };

  const onSegmentColorClick = (id, index) => {
    const segmentation = segmentationService.getSegmentation(id);

    const segment = segmentation.segments[index];
    const { color, opacity } = segment;

    const current = {
      r: color[0],
      g: color[1],
      b: color[2],
      a: opacity / 255.0,
    };

    callColorPickerDialog(uiDialogService, current, (updated, action) => {
      if (action === 'cancel') return;

      segmentationService.setSegmentRGBAColor(id, index, [
        updated.r,
        updated.g,
        updated.b,
        updated.a * 255.0,
      ]);
    });
  };

  const onSegmentToggleVisibility = (id, index) => {
    const segmentation = segmentationService.getSegmentation(id);
    const segment = segmentation.segments[index];

    getToolGroupIdentifiers(id).forEach(group => {
      segmentationService.setSegmentVisibility(id, index, !segment.isVisible, group);
    });
  };

  const onSegmentToggleLock = (id, index) => {
    segmentationService.toggleSegmentLocked(id, index);
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
    const handleActiveViewportChange = (id: string | undefined) => {
      const active = id || viewportGridService.getActiveViewportId();
      const uids = viewportGridService.getDisplaySetsUIDsForViewport(active);

      if (!uids) return;

      const isReconstructable =
        uids?.some(uid => {
          const set = displaySetService.getDisplaySetByUID(uid);

          return set?.isReconstructable;
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
      const { unsubscribe } = viewportGridService.subscribe(event, ({ id }) => {
        handleActiveViewportChange(id);
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
      showAddSegment={configuration.addSegment || true}
      showDeleteSegment={true}
      onSegmentationAdd={onSegmentationAddWrapper}
      onSegmentationDelete={onSegmentationDelete}
      onSegmentationEdit={onSegmentationEdit}
      onSegmentationClick={onSegmentationClick}
      onSegmentationToggleVisibility={onSegmentationToggleVisibility}
      onSegmentationDownload={onSegmentationDownload}
      onSegmentationDownloadRTSS={onSegmentationDownloadRTSS}
      onSegmentationExport={onSegmentationExport}
      onSegmentationOpen={onSegmentationOpen}
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
