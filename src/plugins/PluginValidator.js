const REQUIRED_UNIT_IDS = ['scout', 'soldier', 'tank', 'artillery', 'constructor'];
const REQUIRED_BUILDING_IDS = ['command_center', 'barracks', 'factory', 'shield_generator'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function addIssue(issues, level, message, context = null) {
  issues.push({ level, message, context });
}

function validateManifest(manifest, issues) {
  if (!manifest || typeof manifest !== 'object') {
    addIssue(issues, 'error', 'Missing manifest object.');
    return;
  }

  if (!isNonEmptyString(manifest.id)) {
    addIssue(issues, 'error', 'Manifest is missing a valid id.');
  }

  if (!isNonEmptyString(manifest.name)) {
    addIssue(issues, 'warn', 'Manifest is missing a name.');
  }

  if (!isNonEmptyString(manifest.version)) {
    addIssue(issues, 'warn', 'Manifest is missing a version string.');
  }
}

function validateUnitDefinition(unit, unitIds, issues) {
  if (!unit || typeof unit !== 'object') {
    addIssue(issues, 'error', 'Unit definition is not an object.');
    return;
  }

  if (!isNonEmptyString(unit.id)) {
    addIssue(issues, 'error', 'Unit definition is missing an id.');
  } else if (unitIds.has(unit.id)) {
    addIssue(issues, 'error', `Duplicate unit id: ${unit.id}.`);
  } else {
    unitIds.add(unit.id);
  }

  if (!isNonEmptyString(unit.name)) {
    addIssue(issues, 'warn', `Unit ${unit.id || '(unknown)'} is missing a name.`);
  }

  if (!unit.stats || typeof unit.stats !== 'object') {
    addIssue(issues, 'error', `Unit ${unit.id || '(unknown)'} is missing stats.`);
    return;
  }

  const stats = unit.stats;
  const statFields = ['maxHealth', 'speed', 'damage', 'attackRange', 'attackCooldown'];

  statFields.forEach(field => {
    if (!isFiniteNumber(stats[field])) {
      addIssue(issues, 'error', `Unit ${unit.id || '(unknown)'} stats.${field} must be a number.`);
    }
  });
}

function validateBuildingDefinition(building, unitIds, buildingIds, issues) {
  if (!building || typeof building !== 'object') {
    addIssue(issues, 'error', 'Building definition is not an object.');
    return;
  }

  if (!isNonEmptyString(building.id)) {
    addIssue(issues, 'error', 'Building definition is missing an id.');
  } else if (buildingIds.has(building.id)) {
    addIssue(issues, 'error', `Duplicate building id: ${building.id}.`);
  } else {
    buildingIds.add(building.id);
  }

  if (!isNonEmptyString(building.name)) {
    addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} is missing a name.`);
  }

  if (!isFiniteNumber(building.maxHealth)) {
    addIssue(issues, 'error', `Building ${building.id || '(unknown)'} maxHealth must be a number.`);
  }

  if (!isFiniteNumber(building.constructionTime)) {
    addIssue(issues, 'error', `Building ${building.id || '(unknown)'} constructionTime must be a number.`);
  }

  if (typeof building.canProduce !== 'boolean') {
    addIssue(issues, 'error', `Building ${building.id || '(unknown)'} canProduce must be true or false.`);
  }

  if (building.canProduce === true) {
    if (!Array.isArray(building.producibleUnits) || building.producibleUnits.length === 0) {
      addIssue(issues, 'error', `Building ${building.id || '(unknown)'} must list producibleUnits.`);
    } else {
      building.producibleUnits.forEach(unitId => {
        if (!unitIds.has(unitId)) {
          addIssue(
            issues,
            'error',
            `Building ${building.id || '(unknown)'} references unknown unit id: ${unitId}.`
          );
        }
      });
    }

    if (!isFiniteNumber(building.productionTime)) {
      addIssue(issues, 'error', `Building ${building.id || '(unknown)'} productionTime must be a number.`);
    }
  } else if (building.canProduce === false) {
    if (Array.isArray(building.producibleUnits) && building.producibleUnits.length > 0) {
      addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} has producibleUnits but canProduce is false.`);
    }

    if (isFiniteNumber(building.productionTime)) {
      addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} has productionTime but canProduce is false.`);
    }
  }

  if ('shield' in building) {
    if (building.shield && typeof building.shield === 'object') {
      if (!isFiniteNumber(building.shield.radius)) {
        addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} shield.radius should be a number.`);
      }
      if (!isFiniteNumber(building.shield.strength)) {
        addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} shield.strength should be a number.`);
      }
    } else if (building.shield !== null) {
      addIssue(issues, 'warn', `Building ${building.id || '(unknown)'} shield should be an object or null.`);
    }
  }
}

export function validatePluginGroup(group) {
  const issues = [];

  if (!group || typeof group !== 'object') {
    addIssue(issues, 'error', 'Plugin group is missing or invalid.');
    return { issues, manifest: null };
  }

  validateManifest(group.manifest, issues);

  const units = Array.isArray(group.units) ? group.units : null;
  if (!units) {
    addIssue(issues, 'error', 'Plugin group is missing units array.');
  }

  const buildings = Array.isArray(group.buildings) ? group.buildings : null;
  if (!buildings) {
    addIssue(issues, 'error', 'Plugin group is missing buildings array.');
  }

  const unitIds = new Set();
  const buildingIds = new Set();

  if (units) {
    units.forEach(unit => validateUnitDefinition(unit, unitIds, issues));
  }

  if (buildings) {
    buildings.forEach(building => validateBuildingDefinition(building, unitIds, buildingIds, issues));
  }

  REQUIRED_UNIT_IDS.forEach(unitId => {
    if (!unitIds.has(unitId)) {
      addIssue(issues, 'error', `Required unit id is missing: ${unitId}.`);
    }
  });

  REQUIRED_BUILDING_IDS.forEach(buildingId => {
    if (!buildingIds.has(buildingId)) {
      addIssue(issues, 'error', `Required building id is missing: ${buildingId}.`);
    }
  });

  return { issues, manifest: group.manifest || null };
}

export function validatePluginGroups(groups) {
  const results = [];
  const allIssues = [];

  if (!Array.isArray(groups)) {
    return { results, issues: [{ level: 'error', message: 'Plugin groups is not an array.', context: null }] };
  }

  groups.forEach(group => {
    const result = validatePluginGroup(group);
    results.push(result);
    allIssues.push(...result.issues);
  });

  return { results, issues: allIssues };
}

export function getIssueSummary(issues) {
  const summary = { error: 0, warn: 0 };

  issues.forEach(issue => {
    if (issue.level === 'error') {
      summary.error += 1;
    } else if (issue.level === 'warn') {
      summary.warn += 1;
    }
  });

  return summary;
}

export function formatIssue(issue) {
  const prefix = issue.level === 'error' ? 'ERROR' : 'WARN';
  if (issue.context) {
    return `${prefix}: ${issue.message} (${issue.context})`;
  }
  return `${prefix}: ${issue.message}`;
}
