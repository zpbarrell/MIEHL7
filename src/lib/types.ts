// HL7 Parsed Structures

export interface ParsedComponent {
  value: string;
  position: string; // e.g. "PID.3.1"
}

export interface ParsedField {
  position: string;      // e.g. "PID.3"
  value: string;
  components: ParsedComponent[];
  repetitions: string[];
  raw: string;
}

export interface ParsedSegment {
  name: string;          // e.g. "PID"
  fields: ParsedField[];
  raw: string;
}

export interface ParsedMessage {
  segments: ParsedSegment[];
  messageType: string;   // e.g. "ORM^O01"
  timestamp: string;     // From MSH.7
  raw: string;
  fileName?: string;
}

// Field Dictionary Structures

export interface ComponentDefinition {
  position: number;
  name: string;
  dataType: string;
  description?: string;
}

export interface FieldDefinition {
  field: number;
  name: string;
  dataType: string;
  description: string;
  maxLength?: number;
  required?: boolean;
  components?: ComponentDefinition[];
}

export interface SegmentDefinitions {
  segment: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
}

// EMR Configuration

export interface EmrConfigEntry {
  fieldPosition: string;    // e.g. "ORC.3.1"
  fieldName: string;
  emrLocation: string;      // Description of where in the EMR
  imagePaths: string[];     // Path to EMR screenshots
  notes?: string;
}

export interface EmrConfigData {
  entries: EmrConfigEntry[];
}
