import { hotkeys } from '@ohif/core';
// import { initToolGroups, toolbarButtons } from '@ohif/mode-longitudinal';
import segmentationButtons from './segmentationButtons';
import toolbarButtons from './toolbarButtons';
import initToolGroups from './initToolGroups';

import { id } from './id';

const NON_IMAGE_MODALITIES = ['SM', 'ECG', 'SR', 'SEG', 'RTSTRUCT'];

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
  leftPanel: '@ohif/extension-default.panelModule.seriesList',
  rightPanel: '@ohif/extension-default.panelModule.measure',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const segmentation = {
  panel: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentation',
  panelTool: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentationWithTools',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
};

const dicomSEG = {
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  panel: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentation',
};

const dicomRT = {
  viewport: '@ohif/extension-cornerstone-dicom-rt.viewportModule.dicom-rt',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-rt.sopClassHandlerModule.dicom-rt',
  panel: '@ohif/extension-cornerstone-dicom-seg.panelModule.panelSegmentation',
};

const uploadCore = {
  panel: 'upload-core.panelModule.upload',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  'upload-core': '^0.0.1',
};

function modeFactory({ modeConfiguration }) {
  return {
    id,
    routeName: 'radiology-ai',
    displayName: 'Radiology AI',

    onModeEnter: ({ servicesManager, extensionManager, commandsManager }: withAppTypes) => {
      const { measurementService, toolbarService, toolGroupService } = servicesManager.services;

      measurementService.clearMeasurements();
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      toolbarService.addButtons(toolbarButtons);
      toolbarService.addButtons(segmentationButtons);

      toolbarService.createButtonSection('primary', [
        'MeasurementTools',
        'Zoom',
        'WindowLevel',
        'Pan',
        'TrackballRotate',
        'Capture',
        'Layout',
        'Crosshairs',
        'MoreTools',
      ]);
      toolbarService.createButtonSection('segmentationToolbox', ['BrushTools', 'Shapes']);
      console.log("created toolbox");

    },

    onModeExit: ({ servicesManager }: withAppTypes) => {
      const {
        toolGroupService,
        syncGroupService,
        toolbarService,
        segmentationService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      uiDialogService.dismissAll();
      uiModalService.hide();
      toolGroupService.destroy();
      syncGroupService.destroy();
      segmentationService.destroy();
      cornerstoneViewportService.destroy();
    },

    validationTags: {
      study: [],
      series: [],
    },

    isValidMode: ({ modalities }) => {
      const modalities_list = modalities.split('\\');
      const modalities_filter = modality => NON_IMAGE_MODALITIES.indexOf(modality) === -1;
      const modalities_absent = modalities_list.filter(modalities_filter);

      const valid = modalities_absent.length > 0;
      const description =
        'The mode does not support studies that ONLY include the following modalities: ' +
        NON_IMAGE_MODALITIES.join(', ');

      return { valid, description };
    },

    routes: [
      {
        path: 'uploadmodel',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ohif.leftPanel],
              // OLD:
              // rightPanels: [dicomSEG.panel, uploadCore.panel],
              // replace dicomSEG.panel with segmentation.panelTool
              rightPanels: [segmentation.panelTool, uploadCore.panel],
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: segmentation.viewport,
                  displaySetsToDisplay: [segmentation.sopClassHandler],
                },
                {
                  namespace: dicomSEG.viewport,
                  displaySetsToDisplay: [dicomSEG.sopClassHandler],
                },
                {
                  namespace: dicomRT.viewport,
                  displaySetsToDisplay: [dicomRT.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],

    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [ohif.sopClassHandler, segmentation.sopClassHandler, dicomSEG.sopClassHandler, dicomRT.sopClassHandler],
    hotkeys: [...hotkeys.defaults.hotkeyBindings],
  };
}

const mode = { 
  id, 
  modeFactory, 
  extensionDependencies };

export default mode;
