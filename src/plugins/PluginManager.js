import { pluginGroups } from '@atj1979/vibe-rts-plugins';

export class PluginManager {
  constructor() {
    this.groups = new Map();
    this.activeGroupId = null;

    pluginGroups.forEach(group => {
      if (!group?.manifest?.id) return;
      this.groups.set(group.manifest.id, group);
    });

    const firstGroup = pluginGroups[0]?.manifest?.id || null;
    this.activeGroupId = firstGroup;
  }

  listGroups() {
    return Array.from(this.groups.values()).map(group => group.manifest);
  }

  setActiveGroup(groupId) {
    if (this.groups.has(groupId)) {
      this.activeGroupId = groupId;
      return true;
    }
    return false;
  }

  getActiveGroup() {
    return this.groups.get(this.activeGroupId) || null;
  }

  getUnitDefinition(unitId) {
    const group = this.getActiveGroup();
    if (!group) return null;
    return group.units?.find(unit => unit.id === unitId) || null;
  }

  getBuildingDefinition(buildingId) {
    const group = this.getActiveGroup();
    if (!group) return null;
    return group.buildings?.find(building => building.id === buildingId) || null;
  }
}
