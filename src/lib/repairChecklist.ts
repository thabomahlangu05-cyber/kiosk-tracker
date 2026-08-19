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

/** QA-stage checklist, seeded alongside the repair one at intake. */
export const QA_CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // Software
  { section: "Software", subsection: null, title: "Intunes sync" },
  { section: "Software", subsection: null, title: "Kihama Server" },
  { section: "Software", subsection: null, title: "Kihama Demo" },
  { section: "Software", subsection: null, title: "GoTyme Banking App" },
  { section: "Software", subsection: null, title: "Windows 11 update" },
  { section: "Software", subsection: null, title: "Card Printer Firmware" },
  { section: "Software", subsection: null, title: "Card Printer Test" },
  { section: "Software", subsection: null, title: "Stratos" },
  { section: "Software", subsection: null, title: "Email accounts" },
  { section: "Software", subsection: null, title: "Data dog" },

  // Hardware
  { section: "Hardware", subsection: null, title: "Power AC/DC test" },
  {
    section: "Hardware",
    subsection: null,
    title: "Card Printer functionality and upgrade",
  },
  { section: "Hardware", subsection: null, title: "Gloki Test" },
  {
    section: "Hardware",
    subsection: null,
    title: "Wiring pull and neatness test",
  },
  { section: "Hardware", subsection: null, title: "Connectors" },
  { section: "Hardware", subsection: null, title: "Switches test" },
  {
    section: "Hardware",
    subsection: null,
    title: "PCBs proper installation and functionality",
  },
  { section: "Hardware", subsection: null, title: "Sensors test" },
  { section: "Hardware", subsection: null, title: "LEDs test" },
  { section: "Hardware", subsection: null, title: "Camera test" },

  // Network Connectivity
  {
    section: "Network Connectivity",
    subsection: null,
    title: "Both SIMs connect",
  },
  {
    section: "Network Connectivity",
    subsection: null,
    title: "RMS enabled and connected",
  },
  {
    section: "Network Connectivity",
    subsection: null,
    title: "Internet search",
  },
  { section: "Network Connectivity", subsection: null, title: "APN set" },
  {
    section: "Network Connectivity",
    subsection: null,
    title: "Router backup file",
  },

  // Live Test
  {
    section: "Live Test",
    subsection: null,
    title: "Banking App login (fingerprint scan)",
  },
  { section: "Live Test", subsection: null, title: "Customer Screen touch" },
  {
    section: "Live Test",
    subsection: null,
    title: "Marketing content display",
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
