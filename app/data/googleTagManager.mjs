import { ANALYTICS_HOSTS, AUTOMATION_USER_AGENT_MARKERS } from "./analyticsPolicy.mjs";
import { GOOGLE_CONSENT_BOOTSTRAP } from "./marketingConsent.mjs";

export const GOOGLE_TAG_MANAGER_ID = "GTM-MQJJ4Z5S";
export const GOOGLE_TAG_MANAGER_NOSCRIPT_URL =
  `https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}`;

// This runs before hydration, so apply the same eligibility and consent policy as GA.
export const GOOGLE_TAG_MANAGER_SCRIPT = `
(function(w,d,s,l,i){
  var n=w.navigator||{},h=w.location.hostname.toLowerCase().replace(/\\.$/,''),
      ua=String(n.userAgent||'').trim().toLowerCase();
  if(n.doNotTrack==='1'||n.globalPrivacyControl===true||n.webdriver||
     ${JSON.stringify([...ANALYTICS_HOSTS])}.indexOf(h)===-1||!ua||
     ${JSON.stringify(AUTOMATION_USER_AGENT_MARKERS)}.some(function(marker){return ua.indexOf(marker)!==-1;})||
     w.__aisGtmContainerId===i)return;
  w[l]=w[l]||[];
  w.gtag=w.gtag||function(){w[l].push(arguments);};
  ${GOOGLE_CONSENT_BOOTSTRAP}
  w.__aisGtmContainerId=i;
  w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js',ais_call_tracking_owner:'site-consent-v1'});
  var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
  j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(GOOGLE_TAG_MANAGER_ID)});
`;
