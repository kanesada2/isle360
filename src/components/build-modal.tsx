import React, { useState } from 'react';

import { CatalogModal } from '@/components/catalog-modal';
import { FACILITY_CATALOG, type FacilityCatalogEntry } from '@/domain/facility-catalog';

type Props = {
  visible: boolean;
  onClose: () => void;
  onBuild: (entry: FacilityCatalogEntry) => void;
  availableFacilityKeys: Set<string>;
  funds: number;
  monumentUnderConstruction: boolean;
  discountRate: number;
};

export function BuildModal({ visible, onClose, onBuild, availableFacilityKeys, funds, monumentUnderConstruction, discountRate }: Props) {
  const firstAvailableKey =
    FACILITY_CATALOG.find((e) => availableFacilityKeys.has(e.key))?.key ?? FACILITY_CATALOG[0].key;
  const [selectedKey, setSelectedKey] = useState<string>(firstAvailableKey);
  const selected = FACILITY_CATALOG.find((e) => e.key === selectedKey) ?? FACILITY_CATALOG[0];

  const actualCost = (buildCost: number) => Math.round(buildCost * (1 - discountRate));

  const items = FACILITY_CATALOG.map((e) => ({
    key: e.key,
    name: e.name,
    costLabel: `${actualCost(e.buildCost).toLocaleString()} G`,
    disabled:
      !availableFacilityKeys.has(e.key) ||
      actualCost(e.buildCost) > funds ||
      (e.key === 'monument' && monumentUnderConstruction),
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
      actionLabel={`建設する（${actualCost(selected.buildCost).toLocaleString()} G）`}
      onAction={() => {
        onBuild(selected);
        onClose();
      }}
    />
  );
}
