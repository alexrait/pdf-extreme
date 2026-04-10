import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PDFDocument, 
  rgb, 
  PDFName, 
  PDFNumber, 
  PDFString,
  StandardFonts,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFButton,
  PDFOptionList
} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import fontkit from '@pdf-lib/fontkit';
import interact from 'interactjs';
import bidiFactory from 'bidi-js';
import { 
  FileUp, 
  Download, 
  Plus, 
  Type, 
  CheckSquare, 
  CircleDot, 
  ChevronDown, 
  Trash2, 
  Settings2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
  MousePointer2,
  List,
  PenTool
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { css } from '../styled-system/css';
import { fieldOverlay } from '../styled-system/recipes';
import { FieldProperty, FieldType, PDFState } from './types';

// PDF.js worker setup
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const bidi = bidiFactory();

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [state, setState] = useState<PDFState>({
    fields: [],
    selectedFieldId: null,
    numPages: 0,
    currentPageIndex: 0,
    scale: 1.5,
    isSidebarCollapsed: false,
    customFonts: [],
  });

  // Load fonts from localStorage on mount
  useEffect(() => {
    const savedFonts = localStorage.getItem('pdf-extreme-fonts');
    if (savedFonts) {
      try {
        setState(prev => ({ ...prev, customFonts: JSON.parse(savedFonts) }));
      } catch (e) {
        console.error('Failed to load fonts from localStorage', e);
      }
    }
  }, []);

  // Save fonts to localStorage
  useEffect(() => {
    localStorage.setItem('pdf-extreme-fonts', JSON.stringify(state.customFonts));
  }, [state.customFonts]);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files) as File[]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const fontName = file.name.split('.')[0];
        
        setState(prev => {
          if (prev.customFonts.find(f => f.name === fontName)) return prev;
          return {
            ...prev,
            customFonts: [...prev.customFonts, { name: fontName, data: base64, fileName: file.name }]
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load PDF
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    setPdfBytes(bytes);

    const loadedDoc = await PDFDocument.load(bytes);
    setPdfDoc(loadedDoc);
    
    const pages = loadedDoc.getPages();
    const form = loadedDoc.getForm();
    const existingFields: FieldProperty[] = [];

    // Try to load existing fields
    try {
      const fields = form.getFields();
      fields.forEach(field => {
        const widgets = field.acroField.getWidgets();
        widgets.forEach((widget, index) => {
          const rectangle = widget.getRectangle();
          // In pdf-lib, widget.getPage() might return a PDFPage or undefined
          const pageRef = widget.dict.get(PDFName.of('P'));
          const page = pageRef ? loadedDoc.getPages().find(p => (p.ref as any) === pageRef) : undefined;
          if (!page) return;
          
          const pageIndex = pages.findIndex(p => p.ref === page.ref);
          const { height: pageHeight } = page.getSize();

          // Convert PDF bottom-left to our top-left
          const x = rectangle.x;
          const y = pageHeight - rectangle.y - rectangle.height;

          let type: FieldType = 'text';
          if (field instanceof PDFTextField) type = 'text';
          else if (field instanceof PDFCheckBox) type = 'checkbox';
          else if (field instanceof PDFRadioGroup) type = 'radio';
          else if (field instanceof PDFDropdown) type = 'dropdown';
          else if (field instanceof PDFButton) type = 'button';

          existingFields.push({
            id: `${field.getName()}_${index}`,
            type,
            name: field.getName(),
            x,
            y,
            width: rectangle.width,
            height: rectangle.height,
            pageIndex,
            fontSize: 12,
            isRTL: false,
          });
        });
      });
    } catch (err) {
      console.error('Error loading existing fields:', err);
    }

    setState(prev => ({
      ...prev,
      numPages: pages.length,
      currentPageIndex: 0,
      fields: existingFields,
    }));
    
    renderPage(bytes, 0, state.scale);
  };

  const renderPage = useCallback(async (bytes: Uint8Array, pageIndex: number, scale: number) => {
    if (!bytes || !canvasRef.current) return;

    const loadingTask = pdfjs.getDocument({ 
      data: bytes,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageIndex + 1);
    
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      
      setPageDimensions({ width: viewport.width, height: viewport.height });
      
      const renderContext = {
        canvasContext: context as any,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        intent: 'display',
        canvas: canvasRef.current as any
      };
      
      await page.render(renderContext).promise;
    }
  }, []);

  useEffect(() => {
    if (pdfBytes) {
      renderPage(pdfBytes, state.currentPageIndex, state.scale);
    }
  }, [pdfBytes, state.currentPageIndex, state.scale, renderPage]);

  // Field Management
  const addField = (type: FieldType) => {
    const newField: FieldProperty = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: `${type}_${state.fields.length + 1}`,
      x: 50,
      y: 50,
      width: type === 'checkbox' || type === 'radio' ? 20 : 150,
      height: type === 'checkbox' || type === 'radio' ? 20 : type === 'listbox' ? 100 : 30,
      pageIndex: state.currentPageIndex,
      fontSize: 12,
      isRTL: false,
    };
    
    setState(prev => ({
      ...prev,
      fields: [...prev.fields, newField],
      selectedFieldId: newField.id,
    }));
  };

  const updateField = (id: string, updates: Partial<FieldProperty>) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  };

  const deleteField = (id: string) => {
    setState(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id),
      selectedFieldId: prev.selectedFieldId === id ? null : prev.selectedFieldId,
    }));
  };

  // Interact.js for Drag & Resize
  useEffect(() => {
    const interactable = interact('.draggable-field');
    
    interactable.draggable({
      listeners: {
        move(event) {
          const id = event.target.getAttribute('data-id');
          const dx = event.dx / state.scale;
          const dy = event.dy / state.scale;
          
          setState(prev => ({
            ...prev,
            fields: prev.fields.map(f => {
              if (f.id === id) {
                return { ...f, x: f.x + dx, y: f.y + dy };
              }
              return f;
            })
          }));
        }
      }
    });

    interactable.resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const id = event.target.getAttribute('data-id');
          const { width, height } = event.rect;
          const dx = event.deltaRect.left / state.scale;
          const dy = event.deltaRect.top / state.scale;

          setState(prev => ({
            ...prev,
            fields: prev.fields.map(f => {
              if (f.id === id) {
                return { 
                  ...f, 
                  width: width / state.scale, 
                  height: height / state.scale,
                  x: f.x + dx,
                  y: f.y + dy
                };
              }
              return f;
            })
          }));
        }
      }
    });

    return () => {
      interactable.unset();
    };
  }, [state.scale]);

  // Save PDF
  const savePDF = async () => {
    if (!pdfDoc || !pdfBytes) return;

    // Create a fresh copy to avoid modifying the original state in a way that breaks re-saves
    const docToSave = await PDFDocument.load(pdfBytes);
    docToSave.registerFontkit(fontkit);

    // Embed fonts
    const heeboUrl = 'https://fonts.gstatic.com/s/heebo/v22/NGOmv5_adj_adPn57IQ.ttf';
    const heeboBytes = await fetch(heeboUrl).then(res => res.arrayBuffer());
    const heeboFont = await docToSave.embedFont(heeboBytes);
    
    const helveticaFont = await docToSave.embedFont(StandardFonts.Helvetica);
    const timesRomanFont = await docToSave.embedFont(StandardFonts.TimesRoman);

    // Embed custom fonts
    const embeddedCustomFonts: Record<string, any> = {};
    for (const cf of state.customFonts) {
      try {
        const fontBytes = Uint8Array.from(atob(cf.data), c => c.charCodeAt(0));
        embeddedCustomFonts[cf.name] = await docToSave.embedFont(fontBytes);
      } catch (e) {
        console.error(`Failed to embed custom font ${cf.name}`, e);
      }
    }

    const form = docToSave.getForm();
    const pages = docToSave.getPages();

    for (const f of state.fields) {
      const page = pages[f.pageIndex];
      const { height: pageHeight } = page.getSize();

      const pdfX = f.x;
      const pdfY = pageHeight - f.y - f.height;

      // Select font
      let selectedFont = heeboFont;
      if (f.fontName === 'Helvetica') selectedFont = helveticaFont;
      else if (f.fontName === 'TimesRoman') selectedFont = timesRomanFont;
      else if (f.fontName && embeddedCustomFonts[f.fontName]) selectedFont = embeddedCustomFonts[f.fontName];

      try {
        if (f.type === 'text') {
          const textField = form.createTextField(f.name);
          
          let textValue = f.value || '';
          if (f.isRTL && textValue && f.useVisualOrder) {
            const embedding = bidi.getEmbeddingLevels(textValue);
            const visual = bidi.getVisual(textValue, embedding);
            textValue = visual;
          }
          
          textField.setText(textValue);
          if (f.fontSize) textField.setFontSize(f.fontSize);
          
          textField.addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
            font: selectedFont,
          });
          
          if (f.isRTL) {
            const dict = textField.acroField.dict;
            dict.set(PDFName.of('Q'), PDFNumber.of(2)); // Right aligned
          }
          
          if (f.isMultiline) textField.enableMultiline();
          if (f.maxLength) textField.setMaxLength(f.maxLength);
          
        } else if (f.type === 'checkbox') {
          const checkbox = form.createCheckBox(f.name);
          checkbox.addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
          });
          if (f.isChecked) checkbox.check();
          
        } else if (f.type === 'radio') {
          const group = form.getRadioGroup(f.groupName || f.name) || form.createRadioGroup(f.groupName || f.name);
          group.addOptionToPage(f.exportValue || 'Option', page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
          });
          if (f.isChecked) group.select(f.exportValue || 'Option');
          
        } else if (f.type === 'dropdown') {
          const dropdown = form.createDropdown(f.name);
          dropdown.setOptions(f.options || []);
          dropdown.addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
            font: selectedFont,
          });
          if (f.value) dropdown.select(f.value);
        } else if (f.type === 'button') {
          const button = form.createButton(f.name);
          (button as any).addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
          });
          (button.acroField as any).setNormalCaption(PDFString.of(f.value || 'Button'));
        } else if (f.type === 'listbox') {
          const listBox = form.createOptionList(f.name);
          listBox.setOptions(f.options || []);
          listBox.addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
            font: selectedFont,
          });
          if (f.value) listBox.select(f.value);
        } else if (f.type === 'signature') {
          const textField = form.createTextField(f.name);
          textField.setText('Signature Placeholder');
          textField.addToPage(page, {
            x: pdfX,
            y: pdfY,
            width: f.width,
            height: f.height,
          });
        }
      } catch (err) {
        console.error(`Error creating field ${f.name}:`, err);
      }
    }

    const savedBytes = await docToSave.save();
    const blob = new Blob([savedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pdf-extreme-edited.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setState(prev => ({ ...prev, isSidebarCollapsed: true }));
      }
    };
    handleResize(); // Check on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedField = state.fields.find(f => f.id === state.selectedFieldId);

  return (
    <div className={css({ display: 'flex', h: '100vh', bg: 'gray.50', color: 'gray.900', fontFamily: 'sans', position: 'relative' })}>
      {/* Sidebar / Toolbar */}
      <motion.aside 
        initial={false}
        animate={{ width: state.isSidebarCollapsed ? '0px' : '300px', opacity: state.isSidebarCollapsed ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={css({ bg: 'white', borderRight: '1px solid', borderColor: 'gray.200', display: 'flex', flexDir: 'column', overflow: 'hidden', position: 'relative', zIndex: 20 })}
      >
        <div className={css({ p: 4, borderBottom: '1px solid', borderColor: 'gray.100', display: 'flex', alignItems: 'center', gap: 2, minW: '300px' })}>
          <div className={css({ w: 8, h: 8, bg: 'blue.600', rounded: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' })}>
            <Settings2 size={20} />
          </div>
          <h1 className={css({ fontSize: 'lg', fontWeight: 'bold', letterSpacing: 'tight' })}>PDF Extreme</h1>
        </div>

        <div className={css({ flex: 1, overflowY: 'auto', p: 4 })}>
          <section className={css({ mb: 6 })}>
            <h2 className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'gray.400', textTransform: 'uppercase', mb: 3 })}>File</h2>
            <label className={css({ 
              display: 'flex', alignItems: 'center', gap: 2, p: 2, bg: 'blue.50', color: 'blue.700', rounded: 'md', cursor: 'pointer', fontSize: 'sm', fontWeight: 'medium',
              _hover: { bg: 'blue.100' }
            })}>
              <FileUp size={18} />
              Load PDF
              <input type="file" accept=".pdf" onChange={onFileChange} className={css({ display: 'none' })} />
            </label>
          </section>

          <section className={css({ mb: 6 })}>
            <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 })}>
              <h2 className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'gray.400', textTransform: 'uppercase' })}>Add Fields</h2>
              <button 
                onClick={() => setState(prev => ({ ...prev, fields: [], selectedFieldId: null }))}
                className={css({ fontSize: '10px', color: 'red.500', fontWeight: 'bold', _hover: { color: 'red.600' } })}
              >
                Clear All
              </button>
            </div>
            <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 })}>
              <button onClick={() => addField('text')} className={toolBtnStyle}>
                <Type size={16} /> Text
              </button>
              <button onClick={() => addField('checkbox')} className={toolBtnStyle}>
                <CheckSquare size={16} /> Check
              </button>
              <button onClick={() => addField('radio')} className={toolBtnStyle}>
                <CircleDot size={16} /> Radio
              </button>
              <button onClick={() => addField('dropdown')} className={toolBtnStyle}>
                <ChevronDown size={16} /> Dropdown
              </button>
              <button onClick={() => addField('listbox')} className={toolBtnStyle}>
                <List size={16} /> List Box
              </button>
              <button onClick={() => addField('button')} className={toolBtnStyle}>
                <MousePointer2 size={16} /> Button
              </button>
              <button onClick={() => addField('signature')} className={toolBtnStyle}>
                <PenTool size={16} /> Signature
              </button>
            </div>
          </section>

          <section className={css({ mb: 6 })}>
            <h2 className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'gray.400', textTransform: 'uppercase', mb: 3 })}>Custom Fonts</h2>
            <label className={css({ 
              display: 'flex', alignItems: 'center', gap: 2, p: 2, bg: 'gray.50', border: '1px dashed', borderColor: 'gray.300', color: 'gray.600', rounded: 'md', cursor: 'pointer', fontSize: 'xs',
              _hover: { bg: 'gray.100', borderColor: 'gray.400' }
            })}>
              <Upload size={14} />
              Upload .ttf Font
              <input type="file" accept=".ttf" onChange={handleFontUpload} className={css({ display: 'none' })} multiple />
            </label>
            <div className={css({ mt: 2, display: 'flex', flexDir: 'column', gap: 1 })}>
              {state.customFonts.map(f => (
                <div key={f.name} className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bg: 'gray.50', rounded: 'sm', fontSize: '10px' })}>
                  <span className={css({ fontWeight: 'medium', truncate: true })}>{f.name}</span>
                  <button 
                    onClick={() => setState(prev => ({ ...prev, customFonts: prev.customFonts.filter(cf => cf.name !== f.name) }))}
                    className={css({ color: 'red.400', _hover: { color: 'red.600' } })}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {selectedField && (
            <section className={css({ borderTop: '1px solid', borderColor: 'gray.100', pt: 6 })}>
              <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 })}>
                <h2 className={css({ fontSize: 'xs', fontWeight: 'semibold', color: 'gray.400', textTransform: 'uppercase' })}>Properties</h2>
                <button onClick={() => deleteField(selectedField.id)} className={css({ color: 'red.500', _hover: { color: 'red.600' } })}>
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className={css({ display: 'flex', flexDir: 'column', gap: 4 })}>
                <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                  <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Field Name</label>
                  <input 
                    type="text" 
                    value={selectedField.name} 
                    onChange={(e) => updateField(selectedField.id, { name: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                {(selectedField.type === 'text' || selectedField.type === 'button' || selectedField.type === 'listbox') && (
                  <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                    <label className={css({ fontSize: 'xs', color: 'gray.500' })}>
                      {selectedField.type === 'button' ? 'Button Label' : 'Value'}
                    </label>
                    <input 
                      type="text" 
                      value={selectedField.value || ''} 
                      onChange={(e) => updateField(selectedField.id, { value: e.target.value })}
                      className={inputStyle}
                    />
                  </div>
                )}

                <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                  <input 
                    type="checkbox" 
                    id="isRequired"
                    checked={selectedField.isRequired} 
                    onChange={(e) => updateField(selectedField.id, { isRequired: e.target.checked })}
                  />
                  <label htmlFor="isRequired" className={css({ fontSize: 'xs', color: 'gray.700' })}>Required</label>
                </div>

                {(selectedField.type === 'checkbox' || selectedField.type === 'radio') && (
                  <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                    <input 
                      type="checkbox" 
                      id="isChecked"
                      checked={selectedField.isChecked} 
                      onChange={(e) => updateField(selectedField.id, { isChecked: e.target.checked })}
                    />
                    <label htmlFor="isChecked" className={css({ fontSize: 'xs', color: 'gray.700' })}>Initially Checked</label>
                  </div>
                )}

                <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                  <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Tooltip</label>
                  <input 
                    type="text" 
                    value={selectedField.tooltip || ''} 
                    onChange={(e) => updateField(selectedField.id, { tooltip: e.target.value })}
                    className={inputStyle}
                  />
                </div>

                {(selectedField.type === 'text' || selectedField.type === 'dropdown' || selectedField.type === 'listbox' || selectedField.type === 'button') && (
                  <>
                    <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                      <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Font</label>
                      <select 
                        value={selectedField.fontName || 'Heebo'} 
                        onChange={(e) => updateField(selectedField.id, { fontName: e.target.value })}
                        className={inputStyle}
                      >
                        <option value="Heebo">Heebo (Hebrew/English)</option>
                        <option value="Helvetica">Helvetica (English Only)</option>
                        <option value="TimesRoman">Times Roman (English Only)</option>
                        {state.customFonts.map(f => (
                          <option key={f.name} value={f.name}>{f.name} (Custom)</option>
                        ))}
                      </select>
                    </div>
                    <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                      <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Font Size</label>
                      <input 
                        type="number" 
                        value={selectedField.fontSize} 
                        onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) })}
                        className={inputStyle}
                      />
                    </div>
                  </>
                )}

                {selectedField.type === 'text' && (
                  <>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                      <input 
                        type="checkbox" 
                        id="isRTL"
                        checked={selectedField.isRTL} 
                        onChange={(e) => updateField(selectedField.id, { isRTL: e.target.checked })}
                      />
                      <label htmlFor="isRTL" className={css({ fontSize: 'xs', color: 'gray.700' })}>RTL (Hebrew)</label>
                    </div>
                    {selectedField.isRTL && (
                      <div className={css({ display: 'flex', alignItems: 'center', gap: 2, ml: 4 })}>
                        <input 
                          type="checkbox" 
                          id="useVisualOrder"
                          checked={selectedField.useVisualOrder} 
                          onChange={(e) => updateField(selectedField.id, { useVisualOrder: e.target.checked })}
                        />
                        <label htmlFor="useVisualOrder" className={css({ fontSize: 'xs', color: 'gray.700' })}>Visual Order</label>
                      </div>
                    )}
                    <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                      <input 
                        type="checkbox" 
                        id="isMultiline"
                        checked={selectedField.isMultiline} 
                        onChange={(e) => updateField(selectedField.id, { isMultiline: e.target.checked })}
                      />
                      <label htmlFor="isMultiline" className={css({ fontSize: 'xs', color: 'gray.700' })}>Multiline</label>
                    </div>
                    <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                      <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Max Length</label>
                      <input 
                        type="number" 
                        value={selectedField.maxLength || ''} 
                        onChange={(e) => updateField(selectedField.id, { maxLength: parseInt(e.target.value) })}
                        className={inputStyle}
                      />
                    </div>
                  </>
                )}

                {selectedField.type === 'radio' && (
                  <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                    <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Group Name</label>
                    <input 
                      type="text" 
                      value={selectedField.groupName || ''} 
                      onChange={(e) => updateField(selectedField.id, { groupName: e.target.value })}
                      className={inputStyle}
                    />
                    <label className={css({ fontSize: 'xs', color: 'gray.500', mt: 2 })}>Export Value</label>
                    <input 
                      type="text" 
                      value={selectedField.exportValue || ''} 
                      onChange={(e) => updateField(selectedField.id, { exportValue: e.target.value })}
                      className={inputStyle}
                    />
                  </div>
                )}

                {(selectedField.type === 'dropdown' || selectedField.type === 'listbox') && (
                  <div className={css({ display: 'flex', flexDir: 'column', gap: 1 })}>
                    <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Options (comma separated)</label>
                    <textarea 
                      value={selectedField.options?.join(', ') || ''} 
                      onChange={(e) => updateField(selectedField.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                      className={inputStyle}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className={css({ p: 4, borderTop: '1px solid', borderColor: 'gray.100', minW: '300px' })}>
          <button 
            onClick={savePDF} 
            disabled={!pdfBytes}
            className={css({ 
              w: 'full', py: 2, bg: 'green.600', color: 'white', rounded: 'md', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
              _hover: { bg: 'green.700' },
              _disabled: { bg: 'gray.300', cursor: 'not-allowed' }
            })}
          >
            <Download size={18} /> Export PDF
          </button>
        </div>
      </motion.aside>

      {/* Sidebar Toggle Button */}
      <button 
        onClick={() => setState(prev => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }))}
        className={css({ 
          position: 'absolute', left: state.isSidebarCollapsed ? '10px' : '285px', top: '20px', zIndex: 30,
          bg: 'white', border: '1px solid', borderColor: 'gray.200', rounded: 'full', p: 1.5, shadow: 'md', color: 'gray.600',
          _hover: { bg: 'gray.50', color: 'blue.600' },
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        })}
      >
        {state.isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {/* Main Content Area */}
      <main className={css({ flex: 1, display: 'flex', flexDir: 'column', overflow: 'hidden' })}>
        {/* Top Bar */}
        <div className={css({ h: '56px', bg: 'white', borderBottom: '1px solid', borderColor: 'gray.200', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 6 })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
            <div className={css({ display: 'flex', alignItems: 'center', gap: 1, bg: 'gray.100', p: 1, rounded: 'md' })}>
              <button 
                onClick={() => setState(prev => ({ ...prev, currentPageIndex: Math.max(0, prev.currentPageIndex - 1) }))}
                disabled={state.currentPageIndex === 0}
                className={navBtnStyle}
              >
                <ChevronLeft size={18} />
              </button>
              <span className={css({ fontSize: 'sm', fontWeight: 'medium', px: 2 })}>
                Page {state.currentPageIndex + 1} of {state.numPages || 1}
              </span>
              <button 
                onClick={() => setState(prev => ({ ...prev, currentPageIndex: Math.min(state.numPages - 1, prev.currentPageIndex + 1) }))}
                disabled={state.currentPageIndex === state.numPages - 1 || state.numPages === 0}
                className={navBtnStyle}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
            <button onClick={() => setState(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))} className={navBtnStyle}>
              <ZoomOut size={18} />
            </button>
            <span className={css({ fontSize: 'xs', fontWeight: 'bold', color: 'gray.500', minW: '40px', textAlign: 'center' })}>
              {Math.round(state.scale * 100)}%
            </span>
            <button onClick={() => setState(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))} className={navBtnStyle}>
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        {/* PDF Canvas Area */}
        <div className={css({ flex: 1, overflow: 'auto', p: 8, display: 'flex', justifyContent: 'center' })}>
          <div 
            ref={containerRef}
            className={css({ position: 'relative', boxShadow: '2xl', bg: 'white' })}
            style={{ width: pageDimensions?.width, height: pageDimensions?.height }}
          >
            <canvas ref={canvasRef} className={css({ display: 'block' })} />
            
            {/* Field Overlays */}
            {state.fields
              .filter(f => f.pageIndex === state.currentPageIndex)
              .map(field => (
                <div
                  key={field.id}
                  data-id={field.id}
                  onClick={() => setState(prev => ({ ...prev, selectedFieldId: field.id }))}
                  className={`${fieldOverlay({ selected: state.selectedFieldId === field.id })} draggable-field`}
                  style={{
                    left: field.x * state.scale,
                    top: field.y * state.scale,
                    width: field.width * state.scale,
                    height: field.height * state.scale,
                    direction: field.isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  <div className={css({ display: 'flex', alignItems: 'center', gap: 1, px: 1, overflow: 'hidden' })}>
                    {field.type === 'text' && <Type size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'checkbox' && <CheckSquare size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'radio' && <CircleDot size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'dropdown' && <ChevronDown size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'listbox' && <List size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'button' && <MousePointer2 size={12} className={css({ flexShrink: 0 })} />}
                    {field.type === 'signature' && <PenTool size={12} className={css({ flexShrink: 0 })} />}
                    <span className={css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '9px' })}>
                      {field.name}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const toolBtnStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  p: 2,
  bg: 'gray.50',
  border: '1px solid',
  borderColor: 'gray.200',
  rounded: 'md',
  fontSize: 'xs',
  fontWeight: 'medium',
  color: 'gray.700',
  _hover: { bg: 'gray.100', borderColor: 'gray.300' }
});

const navBtnStyle = css({
  p: 1.5,
  rounded: 'md',
  color: 'gray.600',
  _hover: { bg: 'gray.200' },
  _disabled: { color: 'gray.300', cursor: 'not-allowed' }
});

const inputStyle = css({
  w: 'full',
  p: 2,
  bg: 'gray.50',
  border: '1px solid',
  borderColor: 'gray.200',
  rounded: 'md',
  fontSize: 'sm',
  outline: 'none',
  _focus: { borderColor: 'blue.500', bg: 'white' }
});
