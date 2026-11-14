/*
 * The team section. This file is the one place for the names and the roles.
 * Each photo comes from assets/team_pics/<id>.jpeg through scripts/build-assets.mjs.
 * To show a role under a name, write it in `role`. An empty role shows nothing.
 */
export type TeamMember = {
  /** The file name of the photo in assets/team_pics, without the extension. */
  id: 'adb' | 'fb' | 'mc' | 'ml';
  name: string;
  role: string;
};

export const TEAM: readonly TeamMember[] = [
  { id: 'mc', name: 'Marco Ceccon', role: '' },
  { id: 'adb', name: 'Alessandro De Biasi', role: '' },
  { id: 'ml', name: 'Michele Lizzit', role: '' },
  { id: 'fb', name: 'Federico Bertossi', role: '' },
];
