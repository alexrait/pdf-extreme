export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button' | 'listbox' | 'signature';

export interface CustomFont {
  name: string;
  data: string; // base64
  fileName: string;
}

export interface FieldProperty {
  id: string;
  type: FieldType;
  name: string;
  x: number; // in PDF points
  y: number; // in PDF points
  width: number;
  height: number;
  pageIndex: number;
  
  // Text properties
  value?: string;
  fontSize?: number;
  fontName?: string;
  textColor?: string;
  isRTL?: boolean;
  useVisualOrder?: boolean;
  isMultiline?: boolean;
  maxLength?: number;
  
  // Radio/Checkbox properties
  exportValue?: string;
  groupName?: string; // for radio
  isChecked?: boolean;
  
  // Dropdown properties
  options?: string[];
  
  // Common
  tooltip?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
}

export interface PDFState {
  fields: FieldProperty[];
  selectedFieldId: string | null;
  numPages: number;
  currentPageIndex: number;
  scale: number;
  isSidebarCollapsed: boolean;
  customFonts: CustomFont[];
  pdfPassword?: string;
}
