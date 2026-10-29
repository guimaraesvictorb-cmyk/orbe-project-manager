// GTM sandboxed custom-template source, not a Custom HTML tag.
// Permissions: inject_script exact URL below; access_globals execute
// __orbeGa4Consent; access_consent read analytics_storage.
const injectScript = require('injectScript');
const callInWindow = require('callInWindow');
const isConsentGranted = require('isConsentGranted');
const addConsentListener = require('addConsentListener');
injectScript('https://studio.agenciaorbe.co/rayafit-ga4-bridge.js', () => {
  callInWindow('__orbeGa4Consent', isConsentGranted('analytics_storage'));
  addConsentListener('analytics_storage', (type, granted) => {
    callInWindow('__orbeGa4Consent', granted);
  });
  data.gtmOnSuccess();
}, data.gtmOnFailure);
