export function inferSpeedFromRoadClassMph(roadClass?: string | null): number | null {
  const rc = (roadClass || '').trim().toLowerCase();
  if (!rc) return null;

  // UK defaults. Conservative.
  if (rc === 'motorway') return 70;
  if (rc === 'trunk') return 70;

  if (rc === 'primary') return 60;
  if (rc === 'secondary') return 60;

  if (rc === 'tertiary') return 30;

  if (rc === 'unclassified') return 30;
  if (rc === 'residential') return 30;

  if (rc === 'service') return 20;

  return null;
}
