"use strict";
const _ = require("lodash");

// Breakpoints to calculate PM2.5 Concentration to AQI
const BREAKPOINTS = [
  {
    label: "Good",
    min_concentration: 0,
    max_concentration: 12.1,
    min_aqi: 0,
    max_aqi: 50
  },
  {
    label: "Moderate",
    min_concentration: 12.1,
    max_concentration: 35.5,
    min_aqi: 51,
    max_aqi: 100
  },
  {
    label: "Unhealthy",
    min_concentration: 35.5,
    max_concentration: 55.5,
    min_aqi: 101,
    max_aqi: 150
  },
  {
    label: "Unhealthy For Sensitive Group",
    min_concentration: 55.5,
    max_concentration: 150.5,
    min_aqi: 151,
    max_aqi: 200
  },
  {
    label: "Very Unhealthy",
    min_concentration: 150.5,
    max_concentration: 250.5,
    min_aqi: 201,
    max_aqi: 300
  },
  {
    label: "Hazardous",
    min_concentration: 250.5,
    max_concentration: 350.5,
    min_aqi: 301,
    max_aqi: 400
  },
  {
    label: "☠️",
    min_concentration: 350.5,
    max_concentration: 2773.22,
    min_aqi: 401,
    max_aqi: 2000
  }
];

module.exports = function(concentration) {
  const breakpoints = _.find(BREAKPOINTS, elem => {
    return (
      elem.min_concentration <= concentration &&
      elem.max_concentration >= concentration
    );
  });
  const Cp = concentration;
  const Ihi = breakpoints.max_aqi;
  const Ilo = breakpoints.min_aqi;
  const BPhi = breakpoints.max_concentration;
  const BPlo = breakpoints.min_concentration;

  // Math operation provided by EPA
  const Ip = ((Ihi - Ilo) / (BPhi - BPlo)) * (Cp - BPlo) + Ilo;

  return { aqi: Math.round(Ip), label: breakpoints.label };

}