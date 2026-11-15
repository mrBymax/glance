/*
 * The team section. This file is the one place for the names and the roles.
 * Each photo comes from assets/team_pics/<id>.jpeg through scripts/build-assets.mjs.
 * The list is in alphabetical order of the first name. `role` is the line under the name; an empty role shows nothing.
 */
export type TeamMember = {
  /** The file name of the photo in assets/team_pics, without the extension. */
  id: 'adb' | 'fb' | 'mc' | 'ml';
  name: string;
  role: string;
};

export const TEAM: readonly TeamMember[] = [
  { id: 'adb', name: 'Alessandro De Biasi', role: 'MSc AI and Cybersecurity at University of Udine and Klagenfurt (double degree)' },
  { id: 'fb', name: 'Federico Bertossi', role: 'BSc Computer Science at University of Udine; Software Engineer' },
  { id: 'mc', name: 'Marco Ceccon', role: 'Software Engineer' },
  { id: 'ml', name: 'Michele Lizzit', role: 'MSc in Cybersecurity at ETH Zurich; PhD candidate in Computer Science at University of Udine' },
];
