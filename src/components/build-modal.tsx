import React, { useState } from 'react';

import { CatalogModal } from '@/components/catalog-modal';
import { FACILITY_CATALOG, getActualBuildCost, isFacilityAvailable, type FacilityCatalogEntry } from '@/domain/facility-catalog';
import type { Facility, FacilityId, ResearchId } from '@/domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onBuild: (entry: FacilityCatalogEntry) => void;
  completedResearch: Map<ResearchId, number>;
  facilities: Map<FacilityId, Facility>;
  funds: number;
  discountRate: number;
  actionDisabled?: boolean;
};

export function BuildModal({ visible, onClose, onBuild, completedResearch, facilities, funds, discountRate, actionDisabled = false }: Props) {
  const firstAvailableKey =
    FACILITY_CATALOG.find((e) => isFacilityAvailable(e, completedResearch, funds, discountRate, facilities))?.key ?? FACILITY_CATALOG[0].key;
  const [selectedKey, setSelectedKey] = useState<string>(firstAvailableKey);
  const selected = FACILITY_CATALOG.find((e) => e.key === selectedKey) ?? FACILITY_CATALOG[0];

  const items = FACILITY_CATALOG.map((e) => ({
    key: e.key,
    name: e.name,
    costLabel: `${getActualBuildCost(e, discountRate).toLocaleString()} G`,
    disabled: !isFacilityAvailable(e, completedResearch, funds, discountRate, facilities),
  }));

  return (
    <CatalogModal
      visible={visible}
      onClose={onClose}
      items={items}
      selectedKey={selectedKey}
      onSelectKey={setSelectedKey}
      descriptionTitle={selected.name}
      descriptionText={selected.description}
      actionLabel={`建設する（${getActualBuildCost(selected, discountRate).toLocaleString()} G）`}
      actionForceDisabled={actionDisabled}
      onAction={() => {
        onBuild(selected);
        onClose();
      }}
    />
  );
}
