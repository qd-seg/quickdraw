/** @type {AppTypes.Config} */

window.config = {
    routerBasename: "/",

    extensions: [],
    modes: [],

    customizationService: {
        dicomUploadComponent:
            "@ohif/extension-cornerstone.customizationModule.cornerstoneDicomUploadComponent",
    },

    showStudyList: true,
    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    showLoadingIndicator: true,

    strictZSpacingForVolumeViewport: true,
    useSharedArrayBuffer: false,
    studyListFunctionsEnabled: true,

    defaultDataSourceName: "orthanc",

    dataSources: [
        {
            namespace: "@ohif/extension-default.dataSourcesModule.dicomweb",
            sourceName: "orthanc",

            configuration: {
                friendlyName: "Orthanc DICOM Server",
                name: "Orthanc",

                wadoUriRoot: "/store/wado",
                qidoRoot: "/store/dicom-web",
                wadoRoot: "/store/dicom-web",

                imageRendering: "wadors",
                thumbnailRendering: "wadors",

                supportsFuzzyMatching: true,
                supportsWildcard: true,
                supportsReject: true,

                qidoSupportsIncludeField: true,
                enableStudyLazyLoad: true,
                dicomUploadEnabled: true,
                omitQuotationForMultipartRequest: true,

                bulkDataURI: { enabled: true },
            },
        },
    ],
};
