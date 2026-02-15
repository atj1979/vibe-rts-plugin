import { pluginGroups } from '@atj1979/vibe-rts-plugins';
import { formatIssue, validatePluginGroups } from '../src/plugins/PluginValidator.js';

const { results, issues } = validatePluginGroups(pluginGroups);

if (results.length === 0) {
  console.warn('[Plugins] No plugin groups found to validate.');
} else {
  console.log(`[Plugins] Validating ${results.length} plugin group(s)...`);
}

results.forEach(result => {
  const groupId = result.manifest?.id || 'unknown';
  if (result.issues.length === 0) {
    console.log(`[Plugins] ${groupId}: OK`);
    return;
  }

  console.warn(`[Plugins] ${groupId}: ${result.issues.length} issue(s)`);
  result.issues.forEach(issue => {
    console.warn(`- ${formatIssue(issue)}`);
  });
});

if (issues.length === 0) {
  console.log('[Plugins] Validation complete: no issues found.');
} else {
  console.warn(`[Plugins] Validation complete: ${issues.length} issue(s) found.`);
}
