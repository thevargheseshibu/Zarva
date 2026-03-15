import authEn from "@auth/translations/en";
import jobsEn from "@jobs/translations/en";
import inspectionEn from "@inspection/translations/en";
import paymentEn from "@payment/translations/en";
import notifEn from "@notifications/translations/en";
import workerEn from "@worker/translations/en";
import customerEn from "@customer/translations/en";
import sharedEn from "./en";

import authMl from "@auth/translations/ml";
import jobsMl from "@jobs/translations/ml";
import inspectionMl from "@inspection/translations/ml";
import paymentMl from "@payment/translations/ml";
import notifMl from "@notifications/translations/ml";
import workerMl from "@worker/translations/ml";
import customerMl from "@customer/translations/ml";
import sharedMl from "./ml";

import authHi from "@auth/translations/hi";
import jobsHi from "@jobs/translations/hi";
import inspectionHi from "@inspection/translations/hi";
import paymentHi from "@payment/translations/hi";
import notifHi from "@notifications/translations/hi";
import workerHi from "@worker/translations/hi";
import customerHi from "@customer/translations/hi";
import sharedHi from "./hi";

import authTa from "@auth/translations/ta";
import jobsTa from "@jobs/translations/ta";
import inspectionTa from "@inspection/translations/ta";
import paymentTa from "@payment/translations/ta";
import notifTa from "@notifications/translations/ta";
import workerTa from "@worker/translations/ta";
import customerTa from "@customer/translations/ta";
import sharedTa from "./ta";

if (__DEV__) {
  const allEnKeys = [authEn, jobsEn, inspectionEn, paymentEn, notifEn, workerEn, customerEn, sharedEn].flatMap(Object.keys);
  const dups = allEnKeys.filter((k, i) => allEnKeys.indexOf(k) !== i);
  if (dups.length) console.warn("[i18n] Duplicate keys in English:", dups);
}

export const en = {
  ...sharedEn, ...authEn, ...jobsEn, ...inspectionEn,
  ...paymentEn, ...notifEn, ...workerEn, ...customerEn
};

export const ml = {
  ...sharedMl, ...authMl, ...jobsMl, ...inspectionMl,
  ...paymentMl, ...notifMl, ...workerMl, ...customerMl
};

export const hi = {
  ...sharedHi, ...authHi, ...jobsHi, ...inspectionHi,
  ...paymentHi, ...notifHi, ...workerHi, ...customerHi
};

export const ta = {
  ...sharedTa, ...authTa, ...jobsTa, ...inspectionTa,
  ...paymentTa, ...notifTa, ...workerTa, ...customerTa
};
