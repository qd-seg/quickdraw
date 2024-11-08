import { hotkeys } from '@ohif/core';
import Segmentation from '@ohif/mode-segmentation';

import { id } from './id';

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
  leftPanel: '@ohif/extension-default.panelModule.seriesList',
  rightPanel: '@ohif/extension-default.panelModule.measurements',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const segmentation = {
  sopClassHandlerSEG: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewportSEG: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',

  sopClassHandlerRT: '@ohif/extension-cornerstone-dicom-rt.sopClassHandlerModule.dicom-rt',
  viewportRT: '@ohif/extension-cornerstone-dicom-rt.viewportModule.dicom-rt',
};

const prediction = {
  panel: 'predict-provisioner.panelModule.predict',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  'predict-provisioner': '^0.0.1',
};

const modeFactory = ({ modeConfiguration }) => {
  return {
    id,
    routeName: 'radiology-ai',
    displayName: 'Radiology AI',

    onModeEnter: Segmentation.modeFactory({ modeConfiguration }).onModeEnter,

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
      const list = modalities.split('\\');
      const unsupported = ['SM', 'US', 'MG', 'OT', 'DOC', 'CR'];

      const valid = list.length === 1 ? !unsupported.includes(list[0]) : true;
      const description =
        'The mode does not support studies that ONLY include the following modalities: ' +
        unsupported.join(', ');

      return { valid, description };
    },

    routes: [
      {
        path: 'template',
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [ohif.leftPanel],
              rightPanels: [prediction.panel],
              viewports: [
                {
                  namespace: cornerstone.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: segmentation.viewportSEG,
                  displaySetsToDisplay: [segmentation.sopClassHandlerSEG],
                },
                {
                  namespace: segmentation.viewportRT,
                  displaySetsToDisplay: [segmentation.sopClassHandlerRT],
                },
              ],
            },
          };
        },
      },
    ],

    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [
      ohif.sopClassHandler,
      segmentation.sopClassHandlerSEG,
      segmentation.sopClassHandlerRT,
    ],

    hotkeys: [...hotkeys.defaults.hotkeyBindings],
  };
};

export default { id, modeFactory, extensionDependencies };
