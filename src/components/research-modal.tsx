import React, { useState } from 'react';

import { CatalogModal } from '@/components/catalog-modal';
import { getResearchCost } from '@/domain/facility-actions';
import { RESEARCH_CATALOG, type ResearchCatalogEntry } from '@/domain/research-catalog';
import type { ResearchId } from '@/domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onResearch: (entry: ResearchCatalogEntry) => void;
  completedResearch: Map<ResearchId, number>;
  funds: number;
};

export function ResearchModal({ visible, onClose, onResearch, completedResearch, funds }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(RESEARCH_CATALOG[0].key);
  const selected = RESEARCH_CATALOG.find((e) => e.key === selectedKey) ?? RESEARCH_CATALOG[0];

  const items = RESEARCH_CATALOG.filter(
    (e) => e.repeatable || (completedResearch.get(e.key as ResearchId) ?? 0) === 0,
  ).map((e) => {
    const prerequisitesMet = e.prerequisites.every(
      (prereq) => (completedResearch.get(prereq as ResearchId) ?? 0) >= 1,
    );
    const cost = getResearchCost(e, completedResearch);
    return {
      key: e.key,
      name: e.name,
      costLabel: e.repeatable ? `${cost.toLocaleString()} G〜` : `${cost.toLocaleString()} G`,
      disabled: !prerequisitesMet || cost > funds,
    };
  });

  return (
    <CatalogModal
      visible={visible}
      onClose={onClose}
      items={items}
      selectedKey={selectedKey}
      onSelectKey={setSelectedKey}
      descriptionTitle={selected.name}
      descriptionText={selected.description}
      actionLabel={`研究する（${getResearchCost(selected, completedResearch).toLocaleString()} G）`}
      onAction={() => {
        onResearch(selected);
        onClose();
      }}
    />
  );
}
