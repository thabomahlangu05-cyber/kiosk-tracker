// Default Repair-stage checklist template. Seeded onto every REPAIR job at
// intake (see createUnit in src/app/actions/jobs.ts); technicians can add
// more items per job afterwards.

export interface ChecklistTemplateItem {
  section: string;
  subsection: string | null;
  title: string;
}

export const REPAIR_CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // Top Console
  { section: "Top Console", subsection: null, title: "Replace Lens" },
  { section: "Top Console", subsection: null, title: "Replace LEDs" },
  { section: "Top Console", subsection: null, title: "Check Cover" },
  {
    section: "Top Console",
    subsection: null,
    title: "Check Power, Sensor and Display cables",
  },
  { section: "Top Console", subsection: null, title: "Check antennas" },

  // Mid Console — Wiring
  { section: "Mid Console", subsection: "Wiring", title: "Solder LEDs and Fans" },
  {
    section: "Mid Console",
    subsection: "Wiring",
    title: "Solder LITE PCB power connector",
  },
  {
    section: "Mid Console",
    subsection: "Wiring",
    title: "Solder Multiplugs connector",
  },
  // Mid Console — Boards
  { section: "Mid Console", subsection: "Boards", title: "Strip old LITE PCB" },
  {
    section: "Mid Console",
    subsection: "Boards",
    title: "Install and connect LITE PCB",
  },
  {
    section: "Mid Console",
    subsection: "Boards",
    title: "Install and connect Full board",
  },

  // Bottom Console — Battery Box
  {
    section: "Bottom Console",
    subsection: "Battery Box",
    title: "Strip old parts",
  },
  {
    section: "Bottom Console",
    subsection: "Battery Box",
    title: "Clean and test old parts",
  },
  {
    section: "Bottom Console",
    subsection: "Battery Box",
    title: "Build new Battery Box",
  },
  // Bottom Console — Wiring
  {
    section: "Bottom Console",
    subsection: "Wiring",
    title: "Solder green 7-pin-connector plug",
  },
  {
    section: "Bottom Console",
    subsection: "Wiring",
    title: "Solder green 9-pin-connector plug",
  },

  // Troubleshooting
  { section: "Troubleshooting", subsection: null, title: "Check all wiring" },
  { section: "Troubleshooting", subsection: null, title: "Connect Battery" },
  {
    section: "Troubleshooting",
    subsection: null,
    title: "Component Functionality",
  },

  // Branding
  { section: "Branding", subsection: null, title: "Remove old vinyl" },
  { section: "Branding", subsection: null, title: "Apply new vinyl" },
  { section: "Branding", subsection: null, title: "Remove old plastics" },
  {
    section: "Branding",
    subsection: null,
    title: "Clothe device with new plastics",
  },
  { section: "Branding", subsection: null, title: "Remove old base" },
  {
    section: "Branding",
    subsection: null,
    title: "Prepare and clothe new base",
  },
];

export interface ChecklistItemLike {
  id: string;
  section: string;
  subsection: string | null;
  title: string;
  sequence: number;
  completed: boolean;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string } | null;
}

export interface GroupedSubsection {
  name: string;
  items: ChecklistItemLike[];
}

export interface GroupedSection {
  name: string;
  directItems: ChecklistItemLike[];
  subsections: GroupedSubsection[];
}

/** Buckets a flat, already-ordered item list into section -> (subsection ->) items. */
export function groupChecklist(items: ChecklistItemLike[]): GroupedSection[] {
  const sections: GroupedSection[] = [];
  const sectionIndex = new Map<string, GroupedSection>();
  const subsectionIndex = new Map<string, GroupedSubsection>();

  for (const item of items) {
    let section = sectionIndex.get(item.section);
    if (!section) {
      section = { name: item.section, directItems: [], subsections: [] };
      sectionIndex.set(item.section, section);
      sections.push(section);
    }

    if (item.subsection) {
      const key = `${item.section}::${item.subsection}`;
      let sub = subsectionIndex.get(key);
      if (!sub) {
        sub = { name: item.subsection, items: [] };
        subsectionIndex.set(key, sub);
        section.subsections.push(sub);
      }
      sub.items.push(item);
    } else {
      section.directItems.push(item);
    }
  }

  return sections;
}
