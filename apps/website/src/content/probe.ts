// The results of the probe run (spec section 16) that change website copy.
export type Probe = {
  motion: boolean;
  inputs: boolean;
  speech: 'glasses' | 'phone' | 'none';
  // 'releaseChannel' if the build needs a Developer Center project.
  access: 'developerMode' | 'releaseChannel';
};

// The defaults of Plan 2. Task 8 of Plan 4 writes the real probe results here.
export const PROBE: Probe = { motion: true, inputs: true, speech: 'glasses', access: 'developerMode' };

export type MainYes = 'head' | 'touch' | 'key';

export function mainYes(probe: Probe): MainYes {
  if (probe.motion) return 'head';
  return probe.inputs ? 'touch' : 'key';
}
